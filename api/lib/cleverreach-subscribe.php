<?php
declare(strict_types=1);

/**
 * @return array{ok: bool, message: string}
 */
function cleverreachSubscribe(string $email): array
{
    $configFile = dirname(__DIR__) . '/cleverreach.config.php';
    if (!is_readable($configFile)) {
        return ['ok' => false, 'message' => 'Newsletter nicht konfiguriert.'];
    }

    $config = require $configFile;
    $clientId = trim((string) ($config['client_id'] ?? ''));
    $clientSecret = trim((string) ($config['client_secret'] ?? ''));
    $listId = (int) ($config['list_id'] ?? 0);
    $formId = trim((string) ($config['form_id'] ?? ''));

    if ($clientId === '' || $clientSecret === '' || $listId <= 0 || $formId === '') {
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

    $addRes = crTippspielRequest(
        'POST',
        $apiBase . '/v3/groups.json/' . $listId . '/receivers',
        [
            'email'      => $email,
            'registered' => time(),
            'activated'  => 0,
            'source'     => 'steh-auf.com/tippspiel',
        ],
        $token
    );

    $addStatus = $addRes['status'];
    $alreadyExists = $addStatus === 400 || $addStatus === 409;

    if ($addStatus !== 200 && $addStatus !== 201 && !$alreadyExists) {
        return ['ok' => false, 'message' => 'Newsletter-Anmeldung konnte nicht gespeichert werden.'];
    }

    $userIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    if (str_contains($userIp, ',')) {
        $userIp = trim(explode(',', $userIp)[0]);
    }

    $activateRes = crTippspielRequest(
        'POST',
        $apiBase . '/v3/forms.json/' . $formId . '/send/activate',
        [
            'email'   => $email,
            'doidata' => [
                'user_ip'    => $userIp,
                'referer'    => $_SERVER['HTTP_REFERER'] ?? 'https://www.steh-auf.com/tippspiel/',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            ],
        ],
        $token
    );

    if ($activateRes['status'] !== 200 && $activateRes['status'] !== 201) {
        return ['ok' => false, 'message' => 'Bestätigungsmail konnte nicht versendet werden.'];
    }

    return ['ok' => true, 'message' => 'Newsletter-Anmeldung ausgelöst.'];
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
