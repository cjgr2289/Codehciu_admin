<?php
// navbar.php - Barra de navegación con restricciones por rol
session_start();
require_once 'session-helper.php';

$user = getCurrentUser();
$currentPage = basename($_SERVER['PHP_SELF']);
?>
<nav class="navbar">
    <div class="nav-container">
        <div class="nav-left">
            <a href="inicio.php" class="nav-brand">
                <img src="css/LOGO-small.png" alt="CODEHCIU" class="nav-logo">
                <span>Sistema CODEHCIU</span>
            </a>
        </div>
        
        <div class="nav-center">
            <ul class="nav-menu">
                <?php if (isUserAdmin() || $user['role'] === 'editor'): ?>
                <li class="nav-item <?php echo $currentPage === 'admin.php' ? 'active' : ''; ?>">
                    <a href="admin.php" class="nav-link">Administración</a>
                </li>
                <?php endif; ?>
                
                <?php if (isUserAdmin()): ?>
                <li class="nav-item <?php echo $currentPage === 'usuarios.php' ? 'active' : ''; ?>">
                    <a href="usuarios.php" class="nav-link">Usuarios</a>
                </li>
                <?php endif; ?>
                
                <?php if (isUserAdmin() || $user['role'] === 'contab'): ?>
                <li class="nav-item <?php echo $currentPage === 'control-flujo.php' ? 'active' : ''; ?>">
                    <a href="control-flujo.php" class="nav-link">Control Flujo</a>
                </li>
                <?php endif; ?>
                
                <li class="nav-item <?php echo $currentPage === 'credenciales.php' ? 'active' : ''; ?>">
                    <a href="credenciales.php" class="nav-link">Credenciales</a>
                </li>
                
                <li class="nav-item <?php echo $currentPage === 'politicas.php' ? 'active' : ''; ?>">
                    <a href="politicas.php" class="nav-link">Políticas</a>
                </li>
                
                <li class="nav-item <?php echo $currentPage === 'correo.php' ? 'active' : ''; ?>">
                    <a href="correo.php" class="nav-link">Correo</a>
                </li>
            </ul>
        </div>
        
        <div class="nav-right">
            <div class="user-menu">
                <span class="user-name"><?php echo htmlspecialchars($user['name']); ?></span>
                <span class="user-role">(<?php echo htmlspecialchars($user['role']); ?>)</span>
                <a href="logout.php" class="logout-btn">Cerrar Sesión</a>
            </div>
        </div>
    </div>
</nav>