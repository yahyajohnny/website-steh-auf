<?php
declare(strict_types=1);

/**
 * Aggregiert kommende Shows aus Vivenu + Eventbrite für die Startseite.
 * Filtert OHA! Comedy heraus und blendet Backstage-Events aus.
 */

header('Content-Type: application/json; charset=utf-8');
header('Vary: Accept-Encoding');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Accept');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Nur GET erlaubt.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/events.config.php';
if (!is_readable($configFile)) {
    http_response_code(503);
    echo json_encode([
        'ok'      => false,
        'message' => 'Events API nicht konfiguriert. Bitte api/events.config.php anlegen (Vorlage: events.config.example.php).',
        'events'  => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/** @var array<string,mixed> $cfg */
$cfg = require $configFile;
$vivenuKey = trim((string) ($cfg['vivenuApiKey'] ?? ''));
$ebToken = trim((string) ($cfg['eventbriteToken'] ?? ''));
$sellerIds = array_values(array_filter(array_map('strval', (array) ($cfg['vivenuSellerIds'] ?? []))));
$strict = ($cfg['vivenuStrictFilter'] ?? false) === true;
$cacheMaxAge = max(0, (int) ($cfg['cacheMaxAge'] ?? 300));

if ($cacheMaxAge > 0) {
    header('Cache-Control: public, max-age=' . $cacheMaxAge);
} else {
    header('Cache-Control: no-store');
}

$errors = [];

$vivenu = $vivenuKey !== '' ? fetchVivenuEvents($vivenuKey, $sellerIds, $strict, $errors) : [];
$eventbrite = $ebToken !== '' ? fetchEventbriteEvents($ebToken, $errors) : [];

$events = array_merge($vivenu, $eventbrite);
$events = array_values(array_filter($events, static function (array $e): bool {
    return !eventIsOhaComedy($e['name'] ?? '', '');
}));

usort($events, static function (array $a, array $b): int {
    return strcmp((string) $a['start'], (string) $b['start']);
});

echo json_encode([
    'ok'     => true,
    'events' => $events,
    'errors' => $errors,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ---------------------------------------------------------------------------

function lower(string $value): string
{
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($value, 'UTF-8');
    }
    return strtolower($value);
}

function eventIsOhaComedy(string $name, string $extra = ''): bool
{
    $hay = lower($name . ' ' . $extra);
    // „OHA! Comedy“, „OHA Comedy“, URL-Slugs wie oha-comedy
    return str_contains($hay, 'oha! comedy')
        || str_contains($hay, 'oha comedy')
        || (bool) preg_match('/\boha[!?]?\s*comedy\b/u', $hay)
        || (bool) preg_match('/\boha-comedy\b/u', $hay);
}

function textIsStehAufComedy(string $haystack): bool
{
    $h = lower($haystack);
    if (str_contains($h, 'backstage')) {
        return false;
    }
    if (eventIsOhaComedy($haystack)) {
        return false;
    }
    if (preg_match('/steh\s*auf|stehauf|steh-auf/u', $h)) {
        return true;
    }
    if (preg_match('/open\s*mic/u', $h) && preg_match('/freising|münchen|muenchen|comedy/u', $h)) {
        return true;
    }
    return false;
}

function vivenuRowIsBackstage(array $row): bool
{
    $parts = [
        (string) ($row['name'] ?? ''),
        (string) ($row['slogan'] ?? ''),
        vivenuDescriptionToText($row['description'] ?? ''),
    ];
    if (!empty($row['tags']) && is_array($row['tags'])) {
        foreach ($row['tags'] as $t) {
            if (is_string($t)) {
                $parts[] = $t;
            }
        }
    }
    return str_contains(lower(implode(' ', $parts)), 'backstage');
}

function vivenuDescriptionToText(mixed $description): string
{
    if (is_string($description)) {
        $decoded = json_decode($description, true);
        if (is_array($decoded)) {
            return slateToText($decoded);
        }
        return $description;
    }
    if (is_array($description)) {
        return slateToText($description);
    }
    return '';
}

function slateToText(mixed $nodes): string
{
    $acc = [];
    $walk = static function ($node) use (&$walk, &$acc): void {
        if (is_array($node)) {
            if (isset($node['text']) && is_string($node['text'])) {
                $acc[] = $node['text'];
            }
            foreach ($node as $k => $v) {
                if ($k === 'text') {
                    continue;
                }
                if (is_array($v)) {
                    $walk($v);
                }
            }
        }
    };
    $walk($nodes);
    return implode(' ', $acc);
}

function vivenuRowMatches(array $row, array $sellerAllow, bool $strictFilter): bool
{
    $sid = trim((string) ($row['sellerId'] ?? ''));
    if ($sellerAllow) {
        if ($sid === '' || !in_array($sid, $sellerAllow, true)) {
            return false;
        }
        return !vivenuRowIsBackstage($row);
    }
    if (!$strictFilter) {
        return !vivenuRowIsBackstage($row);
    }
    $parts = [
        (string) ($row['name'] ?? ''),
        (string) ($row['slogan'] ?? ''),
        vivenuDescriptionToText($row['description'] ?? ''),
    ];
    if (!empty($row['tags']) && is_array($row['tags'])) {
        foreach ($row['tags'] as $t) {
            if (is_string($t)) {
                $parts[] = $t;
            }
        }
    }
    return textIsStehAufComedy(implode(' ', $parts));
}

function eventSlugFromStart(string $iso): string
{
    try {
        $dt = new DateTimeImmutable($iso);
    } catch (Exception $e) {
        return '';
    }
    return sprintf('event-%02d-%02d-%04d', (int) $dt->format('d'), (int) $dt->format('m'), (int) $dt->format('Y'));
}

/**
 * @param list<string> $errors
 * @return list<array<string,mixed>>
 */
function fetchVivenuEvents(string $apiKey, array $sellerAllow, bool $strict, array &$errors): array
{
    $out = [];
    try {
        $data = httpGetJson('https://vivenu.com/api/events?top=100&skip=0', [
            'Authorization: Bearer ' . $apiKey,
            'Accept: application/json',
            'User-Agent: steh-auf-events/1.0',
        ]);
    } catch (Throwable $e) {
        $errors[] = 'Vivenu: ' . $e->getMessage();
        return $out;
    }

    $rows = $data['rows'] ?? $data['docs'] ?? [];
    if (!is_array($rows)) {
        return $out;
    }

    $now = time();
    foreach ($rows as $row) {
        if (!is_array($row) || !vivenuRowMatches($row, $sellerAllow, $strict)) {
            continue;
        }
        $name = (string) ($row['name'] ?? '');
        if (eventIsOhaComedy($name, vivenuDescriptionToText($row['description'] ?? '') . ' ' . (string) ($row['slogan'] ?? ''))) {
            continue;
        }
        $start = (string) ($row['start'] ?? '');
        if ($start === '') {
            continue;
        }
        try {
            $startTs = (new DateTimeImmutable($start))->getTimestamp();
        } catch (Exception $e) {
            continue;
        }
        if ($startTs < $now) {
            continue;
        }

        $url = (string) ($row['url'] ?? '');
        $ticketUrl = $url !== '' ? 'https://shop.snapticket.de/event/' . ltrim($url, '/') : '';

        $out[] = [
            'id'             => (string) ($row['_id'] ?? $row['id'] ?? ''),
            'source'         => 'vivenu',
            'name'           => $name,
            'start'          => $start,
            'end'            => $row['end'] ?? null,
            'image'          => $row['image'] ?? null,
            'locationName'   => $row['locationName'] ?? null,
            'locationCity'   => $row['locationCity'] ?? null,
            'locationStreet' => $row['locationStreet'] ?? null,
            'tickets'        => is_array($row['tickets'] ?? null) ? $row['tickets'] : [],
            'url'            => $url,
            'ticketUrl'      => $ticketUrl,
            'slug'           => eventSlugFromStart($start),
        ];
    }
    return $out;
}

/**
 * @param list<string> $errors
 * @return list<array<string,mixed>>
 */
function fetchEventbriteEvents(string $token, array &$errors): array
{
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
        'User-Agent: steh-auf-events/1.0',
    ];
    $ebEvents = [];

    try {
        $orgIds = [];
        try {
            $j1 = httpGetJson('https://www.eventbriteapi.com/v3/users/me/organizations/', $headers);
            foreach ($j1['organizations'] ?? [] as $org) {
                if (!empty($org['id'])) {
                    $orgIds[] = (string) $org['id'];
                }
            }
        } catch (Throwable $e) {
            $errors[] = 'Eventbrite organizations: ' . $e->getMessage();
        }

        foreach ($orgIds as $oid) {
            fetchEventbriteOrgPages($oid, $headers, $ebEvents, $errors);
        }

        if (!$ebEvents) {
            try {
                $j2 = httpGetJson(
                    'https://www.eventbriteapi.com/v3/users/me/owned_events/?status=live&order_by=start_asc&expand=venue&page_size=50',
                    $headers
                );
                foreach ($j2['events'] ?? [] as $ev) {
                    if (is_array($ev)) {
                        $ebEvents[] = $ev;
                    }
                }
            } catch (Throwable $e) {
                $errors[] = 'Eventbrite owned_events: ' . $e->getMessage();
            }
        }

        if (!$ebEvents) {
            try {
                $j4 = httpGetJson(
                    'https://www.eventbriteapi.com/v3/users/me/events/?status=live&order_by=start_asc&expand=venue&page_size=50',
                    $headers
                );
                foreach ($j4['events'] ?? [] as $ev) {
                    if (is_array($ev)) {
                        $ebEvents[] = $ev;
                    }
                }
            } catch (Throwable $e) {
                $errors[] = 'Eventbrite users/me/events: ' . $e->getMessage();
            }
        }
    } catch (Throwable $e) {
        $errors[] = 'Eventbrite: ' . $e->getMessage();
        return [];
    }

    $now = time();
    $mapped = [];
    foreach ($ebEvents as $ev) {
        if (!is_array($ev)) {
            continue;
        }
        $title = '';
        $n = $ev['name'] ?? null;
        if (is_string($n)) {
            $title = $n;
        } elseif (is_array($n) && isset($n['text'])) {
            $title = (string) $n['text'];
        }
        $desc = '';
        if (isset($ev['description']['text'])) {
            $desc = (string) $ev['description']['text'];
        }
        $summary = '';
        if (is_string($ev['summary'] ?? null)) {
            $summary = (string) $ev['summary'];
        } elseif (isset($ev['summary']['text'])) {
            $summary = (string) $ev['summary']['text'];
        }

        $blob = trim($title . ' ' . $desc . ' ' . $summary);
        if (eventIsOhaComedy($title, $desc . ' ' . $summary)) {
            continue;
        }
        if (!textIsStehAufComedy($blob)) {
            continue;
        }

        $utc = $ev['start']['utc'] ?? null;
        if (!is_string($utc) || $utc === '') {
            continue;
        }
        try {
            $startTs = (new DateTimeImmutable($utc))->getTimestamp();
        } catch (Exception $e) {
            continue;
        }
        if ($startTs < $now) {
            continue;
        }

        $locName = null;
        $locCity = null;
        $locStreet = null;
        $venue = $ev['venue'] ?? null;
        if (is_array($venue)) {
            $locName = isset($venue['name']) ? (string) $venue['name'] : null;
            $addr = $venue['address'] ?? null;
            if (is_array($addr)) {
                $locCity = isset($addr['city']) ? (string) $addr['city'] : null;
                $locStreet = isset($addr['address_1']) ? (string) $addr['address_1'] : null;
            }
        }

        $logo = null;
        if (!empty($ev['logo']['url'])) {
            $logo = (string) $ev['logo']['url'];
        }

        $ticketUrl = (string) ($ev['url'] ?? '');
        $endUtc = $ev['end']['utc'] ?? null;

        $mapped[] = [
            'id'             => (string) ($ev['id'] ?? ''),
            'source'         => 'eventbrite',
            'name'           => $title,
            'start'          => $utc,
            'end'            => is_string($endUtc) ? $endUtc : null,
            'image'          => $logo,
            'locationName'   => $locName,
            'locationCity'   => $locCity,
            'locationStreet' => $locStreet,
            'tickets'        => [],
            'url'            => '',
            'ticketUrl'      => $ticketUrl,
            'slug'           => eventSlugFromStart($utc),
            'isFree'         => ($ev['is_free'] ?? false) === true,
        ];
    }
    return $mapped;
}

/**
 * @param list<array<string,mixed>> $ebEvents
 * @param list<string> $errors
 */
function fetchEventbriteOrgPages(string $oid, array $headers, array &$ebEvents, array &$errors): void
{
    $continuation = null;
    do {
        $q = 'status=live&order_by=start_asc&expand=venue&page_size=50';
        if ($continuation) {
            $q .= '&continuation=' . rawurlencode($continuation);
        }
        $url = 'https://www.eventbriteapi.com/v3/organizations/' . rawurlencode($oid) . '/events/?' . $q;
        try {
            $j = httpGetJson($url, $headers);
            foreach ($j['events'] ?? [] as $ev) {
                if (is_array($ev)) {
                    $ebEvents[] = $ev;
                }
            }
            $continuation = !empty($j['pagination']['continuation'])
                ? (string) $j['pagination']['continuation']
                : null;
        } catch (Throwable $e) {
            $errors[] = 'Eventbrite org ' . $oid . ': ' . $e->getMessage();
            break;
        }
    } while ($continuation);
}

/**
 * @param list<string> $headers
 * @return array<string,mixed>
 */
function httpGetJson(string $url, array $headers): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl_init failed');
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException($err !== '' ? $err : 'HTTP request failed');
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('HTTP ' . $status . ': ' . substr($body, 0, 160));
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        throw new RuntimeException('Ungültiges JSON');
    }
    return $data;
}
