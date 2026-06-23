<?php
declare(strict_types=1);

function tippspielLoadConfig(): array
{
    $configFile = dirname(__DIR__) . '/tippspiel.config.php';
    if (!is_readable($configFile)) {
        return [];
    }
    $config = require $configFile;
    return is_array($config) ? $config : [];
}

function tippspielDataFile(): string
{
    $config = tippspielLoadConfig();
    $file = trim((string) ($config['data_file'] ?? ''));
    if ($file === '') {
        $file = dirname(__DIR__) . '/data/tippspiel.json';
    }
    return $file;
}

function tippspielTimezone(): DateTimeZone
{
    $config = tippspielLoadConfig();
    $tz = trim((string) ($config['timezone'] ?? 'Europe/Berlin'));
    try {
        return new DateTimeZone($tz);
    } catch (Exception) {
        return new DateTimeZone('Europe/Berlin');
    }
}

function tippspielDeadline(): DateTimeImmutable
{
    $config = tippspielLoadConfig();
    $tz = tippspielTimezone();
    $deadline = trim((string) ($config['deadline'] ?? '2026-06-25 21:59:59'));
    return new DateTimeImmutable($deadline, $tz);
}

function tippspielNow(): DateTimeImmutable
{
    return new DateTimeImmutable('now', tippspielTimezone());
}

function tippspielIsOpen(): bool
{
    return tippspielNow() <= tippspielDeadline();
}

function tippspielEnsureDataFile(string $file): void
{
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    if (!is_file($file)) {
        file_put_contents($file, "[]\n", LOCK_EX);
    }
}

/** @return array<int, array<string, mixed>> */
function tippspielReadAll(): array
{
    $file = tippspielDataFile();
    tippspielEnsureDataFile($file);

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        throw new RuntimeException('Speicherdatei konnte nicht geöffnet werden.');
    }

    try {
        if (!flock($fp, LOCK_SH)) {
            throw new RuntimeException('Speicherdatei ist gesperrt.');
        }

        $raw = stream_get_contents($fp);
        $data = json_decode($raw ?: '[]', true);
        if (!is_array($data)) {
            $data = [];
        }

        flock($fp, LOCK_UN);
        return $data;
    } finally {
        fclose($fp);
    }
}

/**
 * @param array<string, mixed> $entry
 * @return array{ok: bool, message: string, entry?: array<string, mixed>}
 */
function tippspielAddEntry(array $entry): array
{
    if (!tippspielIsOpen()) {
        return ['ok' => false, 'message' => 'Die Teilnahmefrist ist abgelaufen.'];
    }

    $file = tippspielDataFile();
    tippspielEnsureDataFile($file);

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        return ['ok' => false, 'message' => 'Speicherung fehlgeschlagen. Bitte erneut versuchen.'];
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            return ['ok' => false, 'message' => 'Speicherung gerade ausgelastet. Bitte kurz warten und erneut senden.'];
        }

        rewind($fp);
        $raw = stream_get_contents($fp);
        $data = json_decode($raw ?: '[]', true);
        if (!is_array($data)) {
            $data = [];
        }

        $email = strtolower(trim((string) ($entry['email'] ?? '')));
        foreach ($data as $existing) {
            if (strtolower((string) ($existing['email'] ?? '')) === $email) {
                flock($fp, LOCK_UN);
                return ['ok' => false, 'message' => 'Für diese E-Mail-Adresse wurde bereits ein Tipp abgegeben.'];
            }
        }

        $now = tippspielNow();
        $stored = [
            'id'               => bin2hex(random_bytes(8)),
            'first_name'       => trim((string) ($entry['first_name'] ?? '')),
            'last_name'        => trim((string) ($entry['last_name'] ?? '')),
            'email'            => $email,
            'tip_de'           => (int) ($entry['tip_de'] ?? 0),
            'tip_ec'           => (int) ($entry['tip_ec'] ?? 0),
            'tip_display'      => (string) ($entry['tip_display'] ?? ''),
            'submitted_at'     => $now->format(DateTimeInterface::ATOM),
            'submitted_at_fmt' => $now->format('d.m.Y H:i:s'),
            'valid'            => true,
            'newsletter_ok'    => !empty($entry['newsletter_ok']),
        ];

        $data[] = $stored;

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            flock($fp, LOCK_UN);
            return ['ok' => false, 'message' => 'Speicherung fehlgeschlagen.'];
        }

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json . "\n");
        fflush($fp);
        flock($fp, LOCK_UN);

        return ['ok' => true, 'message' => 'Dein Tipp ist eingegangen. Viel Glück!', 'entry' => $stored];
    } finally {
        fclose($fp);
    }
}

/**
 * @return array{ok: bool, message: string}
 */
function tippspielDeleteById(string $id): array
{
    $id = trim($id);
    if ($id === '' || !preg_match('/^[a-f0-9]{16}$/', $id)) {
        return ['ok' => false, 'message' => 'Ungültige Einreichung.'];
    }

    $file = tippspielDataFile();
    tippspielEnsureDataFile($file);

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        return ['ok' => false, 'message' => 'Löschen fehlgeschlagen.'];
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            return ['ok' => false, 'message' => 'Speicherung gerade ausgelastet. Bitte erneut versuchen.'];
        }

        rewind($fp);
        $raw = stream_get_contents($fp);
        $data = json_decode($raw ?: '[]', true);
        if (!is_array($data)) {
            $data = [];
        }

        $found = false;
        $filtered = [];
        foreach ($data as $row) {
            if ((string) ($row['id'] ?? '') === $id) {
                $found = true;
                continue;
            }
            $filtered[] = $row;
        }

        if (!$found) {
            flock($fp, LOCK_UN);
            return ['ok' => false, 'message' => 'Einreichung nicht gefunden.'];
        }

        $json = json_encode($filtered, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            flock($fp, LOCK_UN);
            return ['ok' => false, 'message' => 'Löschen fehlgeschlagen.'];
        }

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json . "\n");
        fflush($fp);
        flock($fp, LOCK_UN);

        return ['ok' => true, 'message' => 'Einreichung gelöscht.'];
    } finally {
        fclose($fp);
    }
}

function tippspielSetNewsletterOk(string $id, bool $ok): void
{
    $id = trim($id);
    if ($id === '') {
        return;
    }

    $file = tippspielDataFile();
    tippspielEnsureDataFile($file);

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        return;
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            return;
        }

        rewind($fp);
        $raw = stream_get_contents($fp);
        $data = json_decode($raw ?: '[]', true);
        if (!is_array($data)) {
            flock($fp, LOCK_UN);
            return;
        }

        foreach ($data as &$row) {
            if ((string) ($row['id'] ?? '') === $id) {
                $row['newsletter_ok'] = $ok;
                break;
            }
        }
        unset($row);

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            flock($fp, LOCK_UN);
            return;
        }

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json . "\n");
        fflush($fp);
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }
}
