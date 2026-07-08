<?php
/**
 * NVIDIA API PHP Proxy for static React SPA hosted on Apache / Hostinger.
 * Handles CORS and acts as a middleman to call NVIDIA API without exposing keys in frontend code.
 */

// Allow same-origin and basic CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

// Read raw POST body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON payload"]);
    exit;
}

// API Key configuration. If stored in Apache ENV, use it, otherwise fallback to default key.
$apiKey = getenv('NVIDIA_API_KEY');
if (!$apiKey) {
    // Read from .env if it exists in the parent directory
    $envPath = __DIR__ . '/.env';
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            list($name, $value) = explode('=', $line, 2);
            if (trim($name) === 'NVIDIA_API_KEY' || trim($name) === 'VITE_NVIDIA_API_KEY') {
                $apiKey = trim($value);
                break;
            }
        }
    }
}

// Final fallback default key
if (!$apiKey) {
    $apiKey = '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';
}

// Forward the request to NVIDIA
$ch = curl_init("https://integrate.api.nvidia.com/v1/chat/completions");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer " . $apiKey
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(["error" => curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
