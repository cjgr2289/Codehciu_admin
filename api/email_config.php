<?php
/**
 * Configuración de correo electrónico para CODEHCIU
 * Usando PHPMailer con SMTP
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once 'phpmailer/PHPMailer.php';
require_once 'phpmailer/SMTP.php';
require_once 'phpmailer/Exception.php';

/**
 * Configuración del servidor SMTP
 */
define('SMTP_HOST', 'codehciu.org');
define('SMTP_PORT', 465);
define('SMTP_USER', 'finanzas@codehciu.org');
define('SMTP_PASS', 'C0d3hc1u.2026*');
define('SMTP_FROM', 'finanzas@codehciu.org');
define('SMTP_FROM_NAME', 'CODEHCIU - Finanzas');
define('SMTP_SECURE', PHPMailer::ENCRYPTION_SMTPS); // SSL

/**
 * Función para enviar correo
 * @param string $para Email del destinatario
 * @param string $nombre_para Nombre del destinatario
 * @param string $asunto Asunto del correo
 * @param string $cuerpo Cuerpo del correo (HTML)
 * @return array Resultado con success y message
 */
function enviarCorreo($para, $nombre_para, $asunto, $cuerpo) {
    // Validar email
    if (empty($para) || !filter_var($para, FILTER_VALIDATE_EMAIL)) {
        error_log("Email inválido: " . $para);
        return ['success' => false, 'message' => 'Email inválido'];
    }
    
    $mail = new PHPMailer(true);
    
    try {
        // Configuración del servidor
        $mail->SMTPDebug = 0; // 0 = sin debug, 1 = errores, 2 = detallado
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = SMTP_SECURE;
        $mail->Port       = SMTP_PORT;

          // Configurar codificación UTF-8
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'quoted-printable';
        
        // Remitente
        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        
        // Destinatario
        $mail->addAddress($para, $nombre_para);
        
        // Contenido
        $mail->isHTML(true);
        $mail->Subject = $asunto;
        $mail->Body    = $cuerpo;
        $mail->AltBody = strip_tags($cuerpo); // Versión texto plano
        
        $mail->send();
        
        error_log("Correo enviado a: $para - Asunto: $asunto");
        
        return [
            'success' => true,
            'message' => 'Correo enviado exitosamente'
        ];
        
    } catch (Exception $e) {
        error_log("Error al enviar correo a $para: " . $mail->ErrorInfo);
        return [
            'success' => false,
            'message' => 'Error al enviar correo: ' . $mail->ErrorInfo
        ];
    }
}

/**
 * Obtener emails de usuarios por rol
 * @param PDO $pdo Conexión a la BD
 * @param string $rol Rol de los usuarios (contab, directivo, etc.)
 * @return array Lista de emails con nombre
 */
function getEmailsPorRol($pdo, $rol) {
    $query = "SELECT id, nombre, email FROM usuarios WHERE rol = :rol AND Activo = 1";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':rol' => $rol]);
    return $stmt->fetchAll();
}

/**
 * Obtener email de un usuario por ID
 * @param PDO $pdo Conexión a la BD
 * @param int $usuario_id ID del usuario
 * @return array|null Datos del usuario o null
 */
function getUsuarioById($pdo, $usuario_id) {
    $query = "SELECT id, nombre, email FROM usuarios WHERE id = :id AND Activo = 1";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $usuario_id]);
    return $stmt->fetch();
}
?>