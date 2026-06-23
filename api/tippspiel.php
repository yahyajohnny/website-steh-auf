<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/lib/tippspiel-storage.php';
require_once __DIR__ . '/lib/cleverreach-subscribe.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $deadline = tippspielDeadline();
    echo json_encode([
        'ok'       => true,
        'open'     => tippspielIsOpen(),
        'deadline' => $deadline->format(DateTimeInterface::ATOM),
        'deadline_display' => $deadline->format('d.m.Y H:i') . ' Uhr',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Nur GET und POST erlaubt.']);
    exit;
}

$configFile = __DIR__ . '/tippspiel.config.php';
if (!is_readable($configFile)) {
    http_response_code(503);
    echo json_encode([
        'ok'      => false,
        'message' => 'Tippspiel ist noch nicht konfiguriert. Bitte tippspiel.config.php anlegen.',
    ]);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Ungültige Anfrage.']);
    exit;
}

$firstName = trim((string) ($data['first_name'] ?? ''));
$lastName = trim((string) ($data['last_name'] ?? ''));
$email = strtolower(trim((string) ($data['email'] ?? '')));
$consent = !empty($data['consent']);
$tipDe = $data['tip_de'] ?? null;
$tipEc = $data['tip_ec'] ?? null;

if ($firstName === '' || mb_strlen($firstName) > 80) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte gib deinen Vornamen ein.']);
    exit;
}

if ($lastName === '' || mb_strlen($lastName) > 80) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte gib deinen Nachnamen ein.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte gib eine gültige E-Mail-Adresse ein.']);
    exit;
}

if (!$consent) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte stimme den Teilnahmebedingungen und der Newsletter-Anmeldung zu.']);
    exit;
}

if (!is_numeric($tipDe) || !is_numeric($tipEc)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte gib ein gültiges Ergebnis ein.']);
    exit;
}

$tipDeInt = (int) $tipDe;
$tipEcInt = (int) $tipEc;

if ($tipDeInt < 0 || $tipDeInt > 20 || $tipEcInt < 0 || $tipEcInt > 20) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Tore müssen zwischen 0 und 20 liegen.']);
    exit;
}

try {
    $result = tippspielAddEntry([
        'first_name'    => $firstName,
        'last_name'     => $lastName,
        'email'         => $email,
        'tip_de'        => $tipDeInt,
        'tip_ec'        => $tipEcInt,
        'tip_display'   => $tipDeInt . ':' . $tipEcInt,
        'newsletter_ok' => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Speicherung fehlgeschlagen. Bitte erneut versuchen.']);
    exit;
}

if (!$result['ok']) {
    http_response_code($result['message'] === 'Die Teilnahmefrist ist abgelaufen.' ? 403 : 409);
    echo json_encode(['ok' => false, 'message' => $result['message']]);
    exit;
}

$newsletter = cleverreachSubscribe($email, $firstName, $lastName, 'steh-auf.com/tippspiel');

if (!empty($result['entry']['id'])) {
    tippspielSetNewsletterOk((string) $result['entry']['id'], $newsletter['ok']);
}

if ($newsletter['ok']) {
    $message = 'Dein Tipp ist eingegangen. Wir melden uns per E-Mail, wenn du gewonnen hast.';
} else {
    $message = 'Dein Tipp ist eingegangen. Wir melden uns per E-Mail, wenn du gewonnen hast.';
}

echo json_encode([
    'ok'            => true,
    'newsletter_ok' => $newsletter['ok'],
    'message'       => $message,
    'tip_message'   => $message,
], JSON_UNESCAPED_UNICODE);
