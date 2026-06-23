<?php
declare(strict_types=1);

/**
 * Empfänger in CleverReach speichern – ohne Bestätigungsmail.
 *
 * @return array{ok: bool, message: string}
 */
function cleverreachSubscribe(
    string $email,
    string $firstName = '',
    string $lastName = '',
    string $source = 'steh-auf.com'
): array {
    $configFile = dirname(__DIR__) . '/cleverreach.config.php';
    if (!is_readable($configFile)) {
        return ['ok' => false, 'message' => 'Newsletter nicht konfiguriert.'];
    }

    $config = require $configFile;
    $clientId = trim((string) ($config['client_id'] ?? ''));
    $clientSecret = trim((string) ($config['client_secret'] ?? ''));
    $listId = (int) ($config['list_id'] ?? 0);

    if ($clientId === '' || $clientSecret === '' || $listId <= 0) {
        return ['ok' => false, 'message' => 'CleverReach-Konfiguration unvollständig.'];
    }

    $apiBase = 'https://rest.cleverreach.com';

    $tokenRes = crTippspielRequest('POST', $apiBase . '/oauth/token.php', [
        'grant_type'    => 'client_credentials',
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
    ]);

    if ($tokenRes['status'] !== 200 || empty($tokenRes['body']['access_token'])) {
        return ['ok' => false, 'message' => 'Verbindung zu CleverReach fehlgeschlagen.'];
    }

    $token = $tokenRes['body']['access_token'];

    $receiverBody = [
        'email'      => $email,
        'registered' => time(),
        'activated'  => 1,
        'source'     => $source,
    ];

    if ($firstName !== '' || $lastName !== '') {
        $receiverBody['global_attributes'] = [
            'firstname' => $firstName,
            'lastname'  => $lastName,
        ];
    }

    $addRes = crTippspielRequest(
        'POST',
        $apiBase . '/v3/groups.json/' . $listId . '/receivers',
        $receiverBody,
        $token
    );

    $addStatus = $addRes['status'];
    $alreadyExists = $addStatus === 400 || $addStatus === 409;

    if ($addStatus !== 200 && $addStatus !== 201 && !$alreadyExists) {
        return ['ok' => false, 'message' => 'Newsletter-Anmeldung konnte nicht gespeichert werden.'];
    }

    return ['ok' => true, 'message' => 'Newsletter-Anmeldung gespeichert.'];
}

function crTippspielRequest(string $method, string $url, ?array $body = null, ?string $token = null): array
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
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
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
