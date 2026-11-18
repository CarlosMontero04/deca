# DeCA Digital

Plataforma web para que las empresas de transporte por carretera emitan, modifiquen y consulten sus **Documentos de Control Administrativo (DeCA)** en formato digital, tal y como exige la normativa española (Orden FOM/2861/2012), sin papel y sin anotaciones manuscritas.

Cada empresa trabaja con su propia cuenta, su marca y su equipo. Los documentos salen en PDF con el logotipo y los colores de la empresa, llevan un código QR de verificación y se pueden enviar al conductor por WhatsApp o por correo en un par de clics.

Funciona desde el ordenador y desde el móvil, que es donde suelen usarlo los conductores y el personal de tráfico.

## Para quién es

- Empresas de transporte y operadores logísticos que emiten DeCA a diario.
- Cargadores que contratan transporte y necesitan documentarlo.
- Equipos de varias personas: unos emiten y otros administran la cuenta.

## Qué incluye

La aplicación se organiza en módulos. Cada empresa tiene activados los que ha contratado y su menú principal solo muestra esos.

### DeCA Digital

**Emitir un DeCA**

- Datos del cargador contractual, del transportista y del conductor (nombre, DNI, teléfono y correo).
- Tractora y hasta dos remolques.
- Lugar de origen y de destino, paradas intermedias, fecha del transporte, naturaleza de la mercancía, peso bruto, bultos y observaciones.
- Título interno opcional para que la empresa localice el envío con su propia referencia.
- El cargador, el transportista, el conductor, los lugares y la mercancía se pueden rellenar desde datos guardados en la flota, así que no hay que escribir lo mismo cada vez.
- Vista previa del PDF antes de confirmar. Al confirmar, el documento se guarda y queda disponible.
- Nada más emitirlo se puede avisar al conductor por WhatsApp o por correo.
- Cada DeCA recibe un identificador aleatorio del tipo `DECA-2026-XXXXXXXX`, generado con un alfabeto sin caracteres confusos y con una combinación que no se puede adivinar en la práctica.

**Modificar un DeCA**

- Cada cambio genera una **nueva versión** del documento y su PDF se actualiza.
- Se indica el motivo oficial: cambio de vehículo, cambio de conductor, reserva sobre el estado de la mercancía, incidencia grave en ruta, variación de destino, error en el cargador contractual u otro motivo, con un detalle por escrito que sustituye a la anotación manuscrita.
- El historial recoge para cada cambio la fecha, quién lo hizo, el motivo y los valores anterior y nuevo, y se imprime en el propio PDF.
- Se puede avisar al conductor de la versión actualizada.

**Panel de DeCAs**

- Listado con buscador y filtros por estado y por rango de fechas.
- Estados: Borrador, En tránsito, Entregado, Modificado en ruta y Cancelado, que se cambian desde la propia tabla.
- Por cada documento: avisar al conductor por WhatsApp o por correo, editar, previsualizar y descargar el PDF.
- Muestra el transportista, la matrícula, la ruta, la fecha y la versión de cada DeCA.
- **Descarga en paquete** (solo administradores): se eligen los DeCA que se quieren, con los mismos filtros del panel, y se guardan todos de una vez en una carpeta o en un único archivo ZIP.

**Verificación mediante QR**

- Cada PDF lleva un QR. Al escanearlo, cualquier persona (por ejemplo, un agente en carretera) descarga el documento oficial tal y como se emitió, sin necesidad de tener cuenta.
- Las páginas de verificación no se indexan en buscadores.
- Los PDF indican la fecha límite de conservación legal.

### Órdenes de Carga

Para empresas que subcontratan transporte y necesitan dejar el encargo por escrito.

- Se genera una orden con el transportista, las matrículas, las fechas y horas de carga y descarga, el origen, el destino, la mercancía, el precio concertado y las observaciones (con la opción de destacarlas).
- La orden se envía por correo con el PDF adjunto o por WhatsApp con un enlace de descarga temporal, porque incluye el precio pactado y no debe quedar accesible para siempre.
- Listado con buscador, para reenviar, editar, previsualizar y descargar cada orden.

### Gestión de flota

Los datos que se repiten en cada documento se guardan una sola vez y se reutilizan al emitir.

- **Mi empresa:** nombre, CIF, dirección, teléfono, correo, logotipo y colores corporativos.
- **Transportistas, conductores, tractoras y remolques.** Los conductores y los vehículos se pueden vincular a su transportista.
- **Ubicaciones** frecuentes (almacenes, fábricas, puertos) y **mercancías** habituales.
- **Otros cargadores contractuales,** para emitir en nombre de un cliente.
- **Exportación a Excel** de toda la flota, con una hoja por categoría.

## Marca de cada empresa

Los PDF salen con el logotipo, el nombre, los datos de contacto y los colores corporativos de la empresa que los emite. Si una empresa aún no los ha configurado, se usa una cabecera por defecto.

## Equipos, roles y cuentas

- Cada empresa es una **organización** con sus usuarios y sus datos.
- Hay dos roles: **administrador** y **miembro**. Los administradores dan de alta y de baja a los usuarios, cambian los roles, editan el perfil de empresa y usan la descarga en paquete.
- Cada persona gestiona su propia cuenta: nombre visible, correo de acceso y contraseña.
- El alta de nuevos clientes y la activación de módulos se hacen desde un panel interno de administración.

## Cómo está hecha

| Capa | Tecnología |
|---|---|
| Aplicación web | Next.js (App Router), React y TypeScript |
| Estilos e iconos | Tailwind CSS y lucide-react |
| Base de datos, acceso y archivos | Supabase (PostgreSQL, autenticación, almacenamiento y seguridad por filas) |
| PDF y códigos QR | jsPDF y qrcode |
| Excel y ZIP | ExcelJS y JSZip |
| Envío de correo | Nodemailer |
| Pruebas | Vitest |

```
app/
├── deca/, emitir/, modificar/   Panel, emisión y modificación de DeCA
├── carga/                       Órdenes de carga
├── flota/                       Gestión de flota
├── equipo/, cuenta/             Equipo de la empresa y cuenta personal
├── verificar/                   Verificación pública mediante QR
├── admin/                       Panel interno de administración
├── api/                         Rutas de servidor (equipo, correo, administración)
├── components/, hooks/          Piezas reutilizables de la interfaz
└── utils/                       PDF, marca de empresa, notificaciones, exportaciones
```

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm test        # pruebas
```

La aplicación necesita las claves de un proyecto de Supabase, que no forman parte del repositorio.