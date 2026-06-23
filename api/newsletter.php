<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Nur POST erlaubt.']);
    exit;
}

$configFile = __DIR__ . '/cleverreach.config.php';
if (!is_readable($configFile)) {
    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'message' => 'Newsletter ist noch nicht konfiguriert. Bitte cleverreach.config.php anlegen.',
    ]);
    exit;
}

$config = require $configFile;
$clientId = trim((string) ($config['client_id'] ?? ''));
$clientSecret = trim((string) ($config['client_secret'] ?? ''));
$listId = (int) ($config['list_id'] ?? 0);
$formId = trim((string) ($config['form_id'] ?? ''));

if ($clientId === '' || $clientSecret === '' || $listId <= 0 || $formId === '') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => 'CleverReach-Konfiguration unvollständig.']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Ungültige Anfrage.']);
    exit;
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
$consent = !empty($data['consent']);

if (!$consent) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte stimme der Datenschutzerklärung zu.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Bitte gib eine gültige E-Mail-Adresse ein.']);
    exit;
}

$apiBase = 'https://rest.cleverreach.com';

function crRequest(string $method, string $url, ?array $body = null, ?string $token = null): array
{
    $ch = curl_init($url);
    $headers = ['Accept: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['status' => 0, 'body' => null, 'error' => $error ?: 'Verbindungsfehler'];
    }

    $decoded = json_decode($response, true);
    return ['status' => $status, 'body' => $decoded, 'raw' => $response, 'error' => ''];
}

$tokenRes = crRequest('POST', $apiBase . '/oauth/token.php', [
    'grant_type' => 'client_credentials',
    'client_id' => $clientId,
    'client_secret' => $clientSecret,
]);

if ($tokenRes['status'] !== 200 || empty($tokenRes['body']['access_token'])) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'message' => 'Verbindung zu CleverReach fehlgeschlagen.']);
    exit;
}

$token = $tokenRes['body']['access_token'];
$source = 'steh-auf.com';

$receiverBody = [
    'email' => $email,
    'registered' => time(),
    'activated' => 0,
    'source' => $source,
];

$addRes = crRequest(
    'POST',
    $apiBase . '/v3/groups.json/' . $listId . '/receivers',
    $receiverBody,
    $token
);

$addStatus = $addRes['status'];
$alreadyExists = $addStatus === 400 || $addStatus === 409;

if ($addStatus !== 200 && $addStatus !== 201 && !$alreadyExists) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'message' => 'Anmeldung konnte nicht gespeichert werden.']);
    exit;
}

$userIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if (str_contains($userIp, ',')) {
    $userIp = trim(explode(',', $userIp)[0]);
}

$referer = $_SERVER['HTTP_REFERER'] ?? 'https://www.steh-auf.com/';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

$activateRes = crRequest(
    'POST',
    $apiBase . '/v3/forms.json/' . $formId . '/send/activate',
    [
        'email' => $email,
        'doidata' => [
            'user_ip' => $userIp,
            'referer' => $referer,
            'user_agent' => $userAgent,
        ],
    ],
    $token
);

if ($activateRes['status'] !== 200 && $activateRes['status'] !== 201) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'message' => 'Bestätigungsmail konnte nicht versendet werden. Bitte später erneut versuchen.',
    ]);
    exit;
}

echo json_encode([
    'ok' => true,
    'message' => 'Fast geschafft! Schau in dein Postfach und bestätige deine Anmeldung.',
]);
