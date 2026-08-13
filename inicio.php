<?php
// inicio.php - Página de inicio para usuarios autenticados
session_start();
require_once 'session-helper.php';

// Redirigir al login si no está autenticado
if (!isUserLoggedIn()) {
    header('Location: index.php');
    exit();
}

$user = getCurrentUser();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Principal - CODEHCIU</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/admin.css">
    <link rel="shortcut icon" href="css/favicon.ico" type="image/x-icon">
    <style>
        .welcome-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 70vh;
            text-align: center;
            padding: 20px;
            background-color: white;
        }
        
        .welcome-logo {
            max-width: 300px;
            margin-bottom: 30px;
        }
        
        .welcome-message {
            margin-bottom: 20px;
        }
        
        .welcome-message h1 {
            color: #333;
            margin-bottom: 10px;
        }
        
        .welcome-message p {
            color: #666;
            font-size: 1.1em;
        }
        
        .user-role-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-top: 10px;
        }
        
        body {
            background-color: white;
        }
    </style>
</head>
<body>
    <!-- Navbar -->
    <?php include 'navbar.php'; ?>
    
    <!-- Contenido principal -->
    <div class="container">
        <div class="welcome-container">
            <img src="css/LOGO.png" alt="LOGO CODEHCIU" class="welcome-logo">
            
            <div class="welcome-message">
                <h1>Bienvenido, <?php echo htmlspecialchars($user['name']); ?></h1>
                <p>Sistema de Gestión CODEHCIU</p>
                <span class="user-role-badge">Rol: <?php echo htmlspecialchars(ucfirst($user['role'])); ?></span>
            </div>
            
            <div class="quick-stats">
                <p>Seleccione una opción del menú superior para comenzar</p>
            </div>
        </div>
    </div>
    
    <footer>
        <p>&copy; 2015 CODEHCIU. Todos los derechos reservados.</p>
    </footer>
    
    <script src="js/main.js"></script>
</body>
</html>