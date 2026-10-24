# Guía de Despliegue en Producción - MF Computers API

Esta guía explica cómo desplegar la aplicación MF Computers API en un servidor Ubuntu usando PM2 y Nginx.

## Requisitos Previos

- Servidor Ubuntu (versión 20.04 o superior recomendada)
- Acceso SSH al servidor
- Usuario con permisos sudo
- Node.js instalado (versión 18.x o superior)
- MySQL instalado y configurado
- Nginx instalado

## IP del Servidor
**149.50.139.91**

---

## Paso 1: Preparar el Servidor

### 1.1 Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instalar Node.js (si no está instalado)
```bash
# Instalar Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 1.3 Instalar PM2 globalmente
```bash
sudo npm install -g pm2
```

### 1.4 Instalar Nginx (si no está instalado)
```bash
sudo apt install -y nginx

# Iniciar y habilitar Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verificar estado
sudo systemctl status nginx
```

### 1.5 Instalar MySQL Client (si necesitas conectarte a la base de datos)
```bash
sudo apt install -y mysql-client
```

---

## Paso 2: Preparar la Aplicación en el Servidor

### 2.1 Conectarse al servidor
```bash
ssh usuario@149.50.139.91
```

### 2.2 Crear directorio para la aplicación
```bash
# Crear directorio (ajusta el nombre según tu proyecto)
sudo mkdir -p /home/fenecstudio/mfcomputers-API
# O si prefieres usar /var/www:
# sudo mkdir -p /var/www/mfcomputers-api
# sudo chown -R $USER:$USER /var/www/mfcomputers-api
cd /home/fenecstudio/mfcomputers-API
```

### 2.3 Subir el código de la aplicación

**Opción A: Usando Git (recomendado)**
```bash
# Si tu código está en un repositorio Git
git clone https://tu-repositorio.git .
# O si prefieres usar SSH:
# git clone git@github.com:tu-usuario/mfcomputers-api.git .
```

**Opción B: Usando SCP desde tu máquina local**
```bash
# Desde tu máquina local (en otra terminal)
scp -r /ruta/local/mfcomputers-API usuario@149.50.139.91:/home/fenecstudio/
```

### 2.4 Instalar dependencias
```bash
cd /home/fenecstudio/mfcomputers-API
npm install --production
```

### 2.5 Compilar TypeScript
```bash
npm run build
```

### 2.6 Crear directorio para logs
```bash
mkdir -p logs
```

### 2.7 Verificar puerto disponible
```bash
# Verificar qué puertos están en uso
sudo lsof -i -P -n | grep LISTEN | grep node

# Verificar un puerto específico (ejemplo: 8086)
sudo lsof -i :8086

# Si el puerto está ocupado, elige otro puerto libre
```

---

## Paso 3: Configurar Variables de Entorno

### 3.1 Crear archivo .env
```bash
cd /home/fenecstudio/mfcomputers-API
nano .env
```

### 3.2 Configurar variables de entorno
Copia el contenido de `env.production.example` y ajusta los valores:

```env
NODE_ENV=production
PORT=8086

# Configuración de Base de Datos MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=fenecstudio-remote
DB_PASSWORD=tu_password_real_aqui
DB_NAME=mfcomputers

# JWT Secret (debe ser una cadena larga y aleatoria)
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_minimo_32_caracteres

# API Key para integraciones externas
API_KEY=tu-api-key-super-segura-aqui-genera-una-con-openssl-rand-base64-32

# Webhook Secret (opcional)
WEBHOOK_SECRET=tu-webhook-secret-super-seguro-aqui

# CORS Origin (URLs permitidas para hacer peticiones)
# ⚠️ IMPORTANTE: Incluye el dominio del frontend, NO el del backend
CORS_ORIGIN=https://sistema.mfcomputers.com.ar,https://api.sistema.mfcomputers.com.ar,http://localhost:3000
```

**Importante:** 
- Genera un JWT_SECRET seguro: `openssl rand -base64 32`
- Genera una API_KEY segura: `openssl rand -base64 32`
- El `CORS_ORIGIN` debe incluir el dominio del **frontend** (donde se hace la petición), no el del backend
- El puerto debe ser único y no estar en uso por otra aplicación

Guarda el archivo (Ctrl+O, Enter, Ctrl+X en nano).

---

## Paso 4: Configurar PM2

### 4.1 Verificar el archivo de configuración
El archivo `ecosystem.config.js` ya debería estar en el directorio del proyecto. Verifica que tenga el puerto correcto:

```bash
cd /home/fenecstudio/mfcomputers-API
cat ecosystem.config.js | grep PORT
```

Debe mostrar `PORT: 8086` (o el puerto que elegiste).

### 4.2 Iniciar la aplicación con PM2
```bash
cd /home/fenecstudio/mfcomputers-API
pm2 start ecosystem.config.js --env production
```

### 4.3 Verificar que la aplicación está corriendo
```bash
pm2 status
pm2 logs mfcomputers-api --lines 30
```

Deberías ver en los logs:
```
🌐 CORS - Orígenes permitidos: [ 'https://sistema.mfcomputers.com.ar', ... ]
✅ Database connected successfully
🚀 MF Computers API Server running on port 8086
```

### 4.4 Verificar variables de entorno de PM2
```bash
# Ver las variables de entorno del proceso
pm2 env 7 | grep -E "PORT|CORS|NODE_ENV"

# Si no muestra las variables correctas, reinicia PM2
pm2 delete mfcomputers-api
pm2 start ecosystem.config.js --env production
```

### 4.5 Guardar la configuración de PM2
```bash
pm2 save
```

### 4.6 Configurar PM2 para iniciar al arranque del sistema
```bash
pm2 startup
# Ejecuta el comando que PM2 te muestre (normalmente algo como):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u tu_usuario --hp /home/tu_usuario
```

### Comandos útiles de PM2
```bash
pm2 restart mfcomputers-api    # Reiniciar aplicación
pm2 stop mfcomputers-api       # Detener aplicación
pm2 reload mfcomputers-api     # Recarga sin downtime
pm2 delete mfcomputers-api     # Eliminar proceso
pm2 logs mfcomputers-api       # Ver logs en tiempo real
pm2 monit                      # Monitor en tiempo real
pm2 describe mfcomputers-api   # Ver información detallada del proceso
```

---

## Paso 5: Configurar Nginx

### 5.1 Copiar la configuración de Nginx
```bash
cd /home/fenecstudio/mfcomputers-API
sudo cp nginx/mfcomputers.conf /etc/nginx/sites-available/mfcomputers-api
```

### 5.2 Verificar y editar la configuración
```bash
sudo nano /etc/nginx/sites-available/mfcomputers-api
```

**⚠️ IMPORTANTE:** Verifica que el `proxy_pass` apunte al puerto correcto:
```nginx
proxy_pass http://localhost:8086;  # Debe ser el mismo puerto que configuraste en .env
```

Y que incluya el header Origin para CORS:
```nginx
proxy_set_header Origin $http_origin;
```

### 5.3 Habilitar el sitio
```bash
sudo ln -s /etc/nginx/sites-available/mfcomputers-api /etc/nginx/sites-enabled/
```

### 5.4 Verificar configuración de Nginx
```bash
sudo nginx -t
```

Si todo está bien, verás:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5.5 Reiniciar Nginx
```bash
sudo systemctl reload nginx
```

### 5.6 Verificar estado
```bash
sudo systemctl status nginx
```

### 5.7 Verificar que nginx apunta al puerto correcto
```bash
# Ver la configuración activa
sudo nginx -T | grep -A 5 "api.sistema.mfcomputers.com.ar" | grep proxy_pass

# Debe mostrar: proxy_pass http://localhost:8086;
```

---

## Paso 7: Configurar Firewall

### 7.1 Permitir tráfico HTTP y HTTPS
```bash
sudo ufw allow 'Nginx Full'
# O específicamente:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 7.2 Verificar reglas del firewall
```bash
sudo ufw status
```

---

## Paso 8: Verificar el Despliegue

### 8.1 Verificar que la API está corriendo directamente
```bash
curl http://localhost:8086/health
```

Deberías ver:
```json
{"status":"OK","message":"MF Computers API is running","timestamp":"...","port":"8086"}
```

### 8.2 Verificar a través de Nginx (HTTP)
```bash
curl http://api.sistema.mfcomputers.com.ar/health
```

### 8.3 Verificar a través de Nginx (HTTPS)
```bash
curl https://api.sistema.mfcomputers.com.ar/health
```

### 8.4 Verificar CORS
```bash
# Probar CORS directamente al puerto
curl -v -H "Origin: https://sistema.mfcomputers.com.ar" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:8086/api/auth/login 2>&1 | grep -i "access-control"
```

Deberías ver:
```
< Access-Control-Allow-Origin: https://sistema.mfcomputers.com.ar
< Access-Control-Allow-Credentials: true
```

### 8.5 Verificar CORS a través de nginx
```bash
# Probar CORS a través de nginx
curl -v -H "Origin: https://sistema.mfcomputers.com.ar" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://api.sistema.mfcomputers.com.ar/api/auth/login 2>&1 | grep -i "access-control"
```

**⚠️ IMPORTANTE:** Debe mostrar el mismo origen permitido. Si muestra un origen diferente (ej: `norteabanicos.com`), nginx está apuntando al puerto incorrecto.

---

## Paso 6: Configurar SSL/TLS (Recomendado)

Para usar HTTPS, configura Let's Encrypt con Certbot:

### 6.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtener certificado SSL
```bash
# Reemplaza con tu dominio
sudo certbot --nginx -d api.sistema.mfcomputers.com.ar
```

Certbot configurará automáticamente SSL y redirección HTTP a HTTPS.

### 6.3 Verificar certificado
```bash
sudo certbot certificates
```

### 6.4 Configurar renovación automática
Certbot configura automáticamente la renovación. Verifica:
```bash
sudo systemctl status certbot.timer
```

### 6.5 Probar renovación (dry-run)
```bash
sudo certbot renew --dry-run
```

---

## Paso 9: Crear Usuario Administrador

### 9.1 Crear el primer usuario (si no hay usuarios en la BD)

```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@mfcomputers.com.ar",
    "password": "tu_contraseña_segura_aqui",
    "firstName": "Admin",
    "lastName": "MF Computers",
    "role": "admin"
  }'
```

### 9.2 Crear usuarios adicionales (requiere autenticación)

Primero obtén un token:
```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "tu_contraseña"
  }'
```

Luego crea el usuario:
```bash
curl -X POST https://api.sistema.mfcomputers.com.ar/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT_AQUI" \
  -d '{
    "username": "nuevo_usuario",
    "email": "usuario@mfcomputers.com.ar",
    "password": "contraseña_segura_123",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "role": "gerencia"
  }'
```

**Roles disponibles:** `admin`, `gerencia`, `ventas`, `logistica`, `finanzas`, `manager`, `employee`, `viewer`

---

## Actualizar la Aplicación

Cuando necesites actualizar la aplicación:

```bash
cd /home/fenecstudio/mfcomputers-API

# Si usas Git:
git pull origin main

# Instalar nuevas dependencias (si las hay)
npm install --production

# Limpiar y recompilar
rm -rf dist/
npm run build

# Reiniciar con PM2
pm2 restart mfcomputers-api

# Verificar logs
pm2 logs mfcomputers-api --lines 50
```

---

## Monitoreo y Mantenimiento

### Ver logs de la aplicación
```bash
pm2 logs mfcomputers-api
pm2 logs mfcomputers-api --lines 50  # Ver últimas 50 líneas
pm2 logs mfcomputers-api --err       # Solo errores
```

### Ver logs de Nginx
```bash
sudo tail -f /var/log/nginx/mfcomputers-api-access.log
sudo tail -f /var/log/nginx/mfcomputers-api-error.log
```

### Ver logs de PM2
```bash
tail -f /home/fenecstudio/mfcomputers-API/logs/pm2-combined.log
```

### Monitor de recursos
```bash
pm2 monit
```

---

## Solución de Problemas

### La aplicación no inicia
```bash
# Ver logs detallados
pm2 logs mfcomputers-api --err

# Verificar que el puerto 8086 no está en uso
sudo lsof -i :8086

# Verificar variables de entorno
pm2 env 7 | grep -E "PORT|CORS|DB_"

# Verificar el archivo .env
cat /home/fenecstudio/mfcomputers-API/.env | grep -E "PORT|DB_|CORS"
```

### Error de conexión a la base de datos
```bash
# Verificar que las credenciales son correctas
cat /home/fenecstudio/mfcomputers-API/.env | grep DB_

# Verificar conectividad
mysql -h 127.0.0.1 -u fenecstudio-remote -p -e "SELECT 1"

# Verificar que la base de datos existe
mysql -h 127.0.0.1 -u fenecstudio-remote -p -e "SHOW DATABASES;"
```

### Error de CORS
```bash
# Verificar que el .env tiene CORS_ORIGIN correcto
cat /home/fenecstudio/mfcomputers-API/.env | grep CORS_ORIGIN

# Verificar que nginx apunta al puerto correcto
sudo nginx -T | grep -A 5 "api.sistema.mfcomputers.com.ar" | grep proxy_pass

# Probar CORS directamente al puerto
curl -v -H "Origin: https://sistema.mfcomputers.com.ar" \
     -X OPTIONS \
     http://localhost:8086/api/auth/login 2>&1 | grep -i "access-control"

# Probar CORS a través de nginx
curl -v -H "Origin: https://sistema.mfcomputers.com.ar" \
     -X OPTIONS \
     https://api.sistema.mfcomputers.com.ar/api/auth/login 2>&1 | grep -i "access-control"
```

**Si CORS funciona directamente pero no a través de nginx:**
- Verifica que nginx apunta al puerto correcto (8086, no 8083)
- Verifica que nginx tiene el header `proxy_set_header Origin $http_origin;`
- Recarga nginx: `sudo systemctl reload nginx`

### Nginx no funciona
```bash
# Verificar configuración
sudo nginx -t

# Ver logs de error
sudo tail -f /var/log/nginx/error.log

# Verificar que Nginx está corriendo
sudo systemctl status nginx

# Ver qué configuración está activa
sudo nginx -T | grep -B 10 -A 30 "api.sistema.mfcomputers.com.ar"
```

### PM2 muestra "Errored"
```bash
# Ver logs de error
pm2 logs mfcomputers-api --err

# Verificar variables de entorno
pm2 env 7

# Verificar que el código compilado existe
ls -la /home/fenecstudio/mfcomputers-API/dist/index.js

# Si no existe, recompilar
cd /home/fenecstudio/mfcomputers-API
npm run build
pm2 restart mfcomputers-api
```

### El puerto está ocupado por otra aplicación
```bash
# Ver qué proceso está usando el puerto
sudo lsof -i :8086

# Ver todos los procesos de PM2
pm2 list

# Ver qué puerto usa cada proceso
for id in 0 1 3 4 7 8; do
  echo "=== Proceso $id ==="
  pm2 describe $id 2>/dev/null | grep -E "name|script" || echo "No existe"
  pm2 env $id 2>/dev/null | grep PORT || echo "Sin PORT"
  echo ""
done
```

---

## Estructura de Archivos en el Servidor

```
/home/fenecstudio/mfcomputers-API/
├── dist/                    # Código compilado (generado)
├── logs/                    # Logs de PM2
├── node_modules/            # Dependencias
├── src/                     # Código fuente
├── nginx/                   # Configuraciones de nginx
│   └── mfcomputers.conf    # Configuración de nginx
├── ecosystem.config.js      # Configuración PM2
├── .env                     # Variables de entorno (NO versionar)
├── env.production.example   # Ejemplo de variables de entorno
├── package.json
└── ...
```

---

## Comandos de Emergencia

### Reiniciar todo
```bash
pm2 restart all
sudo systemctl restart nginx
```

### Detener todo
```bash
pm2 stop all
sudo systemctl stop nginx
```

### Ver estado general
```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status mysql  # Si MySQL está local
```

---

## Notas Importantes

1. **Seguridad**: 
   - Asegúrate de que el archivo `.env` no esté en el repositorio Git. Está en `.gitignore`.
   - Genera JWT_SECRET y API_KEY seguros usando `openssl rand -base64 32`
   - No compartas las credenciales de la base de datos

2. **Puertos**: 
   - Verifica que el puerto que uses (ej: 8086) no esté ocupado por otra aplicación
   - El puerto debe ser el mismo en `.env`, `ecosystem.config.js` y `nginx`

3. **CORS**: 
   - El `CORS_ORIGIN` debe incluir el dominio del **frontend**, no el del backend
   - Si tienes múltiples orígenes, sepáralos por comas: `https://sistema.mfcomputers.com.ar,http://localhost:3000`
   - Verifica que nginx apunta al puerto correcto para evitar problemas de CORS

4. **Backups**: Configura backups regulares de la base de datos:
```bash
# Ejemplo de backup diario
mysqldump -h 127.0.0.1 -u fenecstudio-remote -p mfcomputers > backup_$(date +%Y%m%d).sql
```

5. **Actualizaciones**: Mantén el sistema operativo y las dependencias actualizadas.

6. **Monitoreo**: Considera usar herramientas como `pm2-logrotate` para rotar logs automáticamente.

7. **SSL/TLS**: Siempre usa HTTPS en producción. Certbot renueva automáticamente los certificados cada 90 días.

---

## Checklist de Verificación Post-Despliegue

Antes de considerar el despliegue completo, verifica:

- [ ] La API responde en `http://localhost:8086/health`
- [ ] La API responde a través de nginx en `https://api.sistema.mfcomputers.com.ar/health`
- [ ] CORS funciona correctamente (ver sección 8.4 y 8.5)
- [ ] SSL/TLS está configurado y funciona
- [ ] PM2 muestra el proceso como "online"
- [ ] Los logs no muestran errores de conexión a la base de datos
- [ ] Se puede crear un usuario administrador
- [ ] El frontend puede hacer peticiones a la API sin errores de CORS

## Soporte

Si encuentras problemas durante el despliegue, verifica en este orden:

1. **Logs de PM2**: `pm2 logs mfcomputers-api --lines 50`
2. **Logs de Nginx**: `/var/log/nginx/mfcomputers-api-error.log`
3. **Estado de servicios**: 
   - `pm2 status`
   - `sudo systemctl status nginx`
4. **Conectividad**: 
   - `sudo ufw status`
   - `curl http://localhost:8086/health`
5. **Configuración de nginx**: `sudo nginx -T | grep -A 30 "api.sistema.mfcomputers.com.ar"`
6. **Variables de entorno**: `pm2 env 7 | grep -E "PORT|CORS|DB_"`

