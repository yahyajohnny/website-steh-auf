<?php
declare(strict_types=1);

session_start();

require_once __DIR__ . '/lib/tippspiel-storage.php';

$configFile = __DIR__ . '/tippspiel.config.php';
if (!is_readable($configFile)) {
    http_response_code(503);
    echo 'Tippspiel nicht konfiguriert. Bitte tippspiel.config.php anlegen.';
    exit;
}

$config = require $configFile;
$adminPassword = (string) ($config['admin_password'] ?? '');

$error = '';
$notice = '';
$export = isset($_GET['export']) && $_GET['export'] === 'csv';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (hash_equals($adminPassword, (string) $_POST['password'])) {
        $_SESSION['tippspiel_admin'] = true;
        header('Location: tippspiel-admin.php');
        exit;
    }
    $error = 'Falsches Passwort.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id']) && !empty($_SESSION['tippspiel_admin'])) {
    try {
        $result = tippspielDeleteById((string) $_POST['delete_id']);
        if ($result['ok']) {
            $_SESSION['tippspiel_notice'] = $result['message'];
        } else {
            $_SESSION['tippspiel_error'] = $result['message'];
        }
    } catch (Throwable $e) {
        $_SESSION['tippspiel_error'] = 'Löschen fehlgeschlagen.';
    }
    header('Location: tippspiel-admin.php');
    exit;
}

if (isset($_GET['logout'])) {
    unset($_SESSION['tippspiel_admin']);
    header('Location: tippspiel-admin.php');
    exit;
}

$authenticated = !empty($_SESSION['tippspiel_admin']);

if ($authenticated && !empty($_SESSION['tippspiel_notice'])) {
    $notice = (string) $_SESSION['tippspiel_notice'];
    unset($_SESSION['tippspiel_notice']);
}

if ($authenticated && !empty($_SESSION['tippspiel_error'])) {
    $error = (string) $_SESSION['tippspiel_error'];
    unset($_SESSION['tippspiel_error']);
}

if ($authenticated) {
    try {
        $entries = tippspielReadAll();
    } catch (Throwable $e) {
        $entries = [];
        $error = 'Einträge konnten nicht geladen werden.';
    }

    usort($entries, static function (array $a, array $b): int {
        return strcmp((string) ($b['submitted_at'] ?? ''), (string) ($a['submitted_at'] ?? ''));
    });

    if ($export) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="tippspiel-einreichungen.csv"');
        $out = fopen('php://output', 'w');
        if ($out !== false) {
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($out, ['Zeitstempel', 'Vorname', 'Nachname', 'E-Mail', 'Tipp', 'Gültig', 'Newsletter'], ';');
            foreach ($entries as $row) {
                fputcsv($out, [
                    $row['submitted_at_fmt'] ?? $row['submitted_at'] ?? '',
                    $row['first_name'] ?? '',
                    $row['last_name'] ?? '',
                    $row['email'] ?? '',
                    $row['tip_display'] ?? '',
                    !empty($row['valid']) ? 'ja' : 'nein',
                    !empty($row['newsletter_ok']) ? 'ja' : 'nein',
                ], ';');
            }
            fclose($out);
        }
        exit;
    }
}

?><!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Tippspiel – Admin</title>
  <style>
    :root {
      --bg: #f8f7fc;
      --surface: #fff;
      --border: #e2dff0;
      --text: #1a1830;
      --muted: #5a5875;
      --accent: #e20e7e;
      --navy: #29285b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .wrap { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; color: var(--navy); }
    .meta { color: var(--muted); margin-bottom: 24px; font-size: 0.95rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
    }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; }
    input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      margin-bottom: 12px;
    }
    button, .btn {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.95rem;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-secondary { background: var(--navy); }
    .toolbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
    .error { color: #b00020; margin-bottom: 12px; font-size: 0.9rem; }
    .notice { color: #0d7a3e; margin-bottom: 12px; font-size: 0.9rem; }
    .btn-danger { background: #b00020; padding: 6px 10px; font-size: 0.8rem; }
    .btn-danger:hover { background: #8a0019; }
    .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th { background: #f0eef8; font-weight: 600; position: sticky; top: 0; }
    tr:last-child td { border-bottom: none; }
    .count { font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <?php if (!$authenticated): ?>
      <h1>Tippspiel Admin</h1>
      <p class="meta">Zugang nur für Veranstalter.</p>
      <div class="card">
        <?php if ($error): ?><p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
        <form method="post">
          <label for="password">Passwort</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" />
          <button type="submit">Anmelden</button>
        </form>
      </div>
    <?php else: ?>
      <h1>Tippspiel – Einreichungen</h1>
      <p class="meta">
        <span class="count"><?= count($entries) ?></span> Einreichungen ·
        Frist bis <?= htmlspecialchars(tippspielDeadline()->format('d.m.Y H:i'), ENT_QUOTES, 'UTF-8') ?> Uhr ·
        Status: <?= tippspielIsOpen() ? 'offen' : 'geschlossen' ?>
      </p>
      <div class="toolbar">
        <a class="btn" href="tippspiel-admin.php?export=csv">CSV exportieren</a>
        <a class="btn btn-secondary" href="tippspiel-admin.php?logout=1">Abmelden</a>
      </div>
      <?php if ($notice): ?><p class="notice"><?= htmlspecialchars($notice, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
      <?php if ($error): ?><p class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Zeitstempel</th>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>E-Mail</th>
              <th>Tipp</th>
              <th>Newsletter</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($entries)): ?>
              <tr><td colspan="7">Noch keine Einreichungen.</td></tr>
            <?php else: ?>
              <?php foreach ($entries as $row): ?>
                <tr>
                  <td><?= htmlspecialchars((string) ($row['submitted_at_fmt'] ?? $row['submitted_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                  <td><?= htmlspecialchars((string) ($row['first_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                  <td><?= htmlspecialchars((string) ($row['last_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                  <td><?= htmlspecialchars((string) ($row['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                  <td><?= htmlspecialchars((string) ($row['tip_display'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                  <td><?= !empty($row['newsletter_ok']) ? 'ja' : 'nein' ?></td>
                  <td>
                    <form method="post" onsubmit="return confirm('Einreichung wirklich löschen?');">
                      <input type="hidden" name="delete_id" value="<?= htmlspecialchars((string) ($row['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" />
                      <button type="submit" class="btn btn-danger">Löschen</button>
                    </form>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
