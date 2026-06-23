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

require_once __DIR__ . '/lib/cleverreach-subscribe.php';

$configFile = __DIR__ . '/cleverreach.config.php';
if (!is_readable($configFile)) {
    http_response_code(503);
    echo json_encode([
        'ok'      => false,
        'message' => 'Newsletter ist noch nicht konfiguriert. Bitte cleverreach.config.php anlegen.',
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

$result = cleverreachSubscribe($email, '', '', 'steh-auf.com');

if (!$result['ok']) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'message' => $result['message']]);
    exit;
}

echo json_encode([
    'ok'      => true,
    'message' => 'Danke! Du bist für den Newsletter angemeldet.',
], JSON_UNESCAPED_UNICODE);
