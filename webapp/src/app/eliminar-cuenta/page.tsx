import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Eliminar cuenta y datos · Zeta",
  description:
    "Cómo solicitar la eliminación de tu cuenta y de todos los datos asociados en Zeta.",
};

const CONTACT_EMAIL = "giraldo.0302@gmail.com";

export default function EliminarCuentaPage() {
  return (
    <LegalLayout
      title="Eliminar cuenta y datos"
      lastUpdated="22 de abril de 2026"
    >
      <p>
        Esta página explica cómo puedes solicitar la eliminación de tu cuenta
        de Zeta y de todos los datos asociados. Cumple con los requisitos de
        Google Play Console y App Store sobre gestión de datos del usuario.
      </p>

      <h2>1. Cómo solicitar la eliminación</h2>
      <p>
        Envíanos un correo a{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20Zeta`}
          className="text-foreground underline decoration-dotted underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        con:
      </p>
      <ul>
        <li>Asunto: <em>Solicitud de eliminación de cuenta Zeta</em>.</li>
        <li>
          El correo electrónico con el que te registraste (debe coincidir con
          el remitente del mensaje).
        </li>
        <li>
          Opcional: motivo de la solicitud (nos ayuda a mejorar, pero no es
          requerido).
        </li>
      </ul>
      <p>
        Verificaremos tu identidad comparando el correo remitente con la
        cuenta en nuestro sistema. Procesamos las solicitudes en un plazo
        máximo de <strong>7 días hábiles</strong>.
      </p>

      <h2>2. Qué datos se eliminan</h2>
      <p>Al eliminar tu cuenta borramos de forma permanente:</p>
      <ul>
        <li>Tu perfil, correo electrónico y credenciales de autenticación.</li>
        <li>
          Todas tus transacciones, cuentas bancarias, saldos, extractos
          importados y contraseñas de PDF.
        </li>
        <li>
          Tus categorías, presupuestos, destinatarios, recurrentes, deseos y
          cualquier configuración personalizada.
        </li>
        <li>
          Tus dispositivos vinculados, sesiones activas y tokens de acceso.
        </li>
        <li>
          Cualquier archivo subido (PDFs de extractos, capturas, etc.).
        </li>
      </ul>

      <h2>3. Qué datos se retienen y por qué</h2>
      <p>
        Por obligaciones legales y de integridad del servicio, algunos datos
        pueden conservarse de forma desidentificada tras la eliminación:
      </p>
      <ul>
        <li>
          Registros de autenticación y accesos anonimizados (≤ 90 días) para
          investigación de fraude y auditoría de seguridad.
        </li>
        <li>
          Respaldos cifrados pueden contener tus datos hasta por{" "}
          <strong>30 días</strong> mientras expiran los ciclos de backup.
          Pasado ese período, quedan eliminados de forma definitiva.
        </li>
        <li>
          Información agregada no identificable (ej. conteos totales) usada
          para métricas internas.
        </li>
      </ul>

      <h2>4. Reversibilidad</h2>
      <p>
        La eliminación es <strong>permanente e irreversible</strong>. No
        podemos recuperar una cuenta eliminada ni sus datos. Si solo quieres
        pausar el uso, considera cerrar sesión en todos tus dispositivos en
        vez de eliminar.
      </p>

      <h2>5. Contacto</h2>
      <p>
        Si tienes dudas sobre el proceso o el estado de tu solicitud,
        escríbenos a{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-foreground underline decoration-dotted underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>
        . También puedes consultar nuestra{" "}
        <Link
          href="/privacy"
          className="text-foreground underline decoration-dotted underline-offset-2"
        >
          Política de Privacidad
        </Link>{" "}
        para entender cómo tratamos tus datos en general.
      </p>
    </LegalLayout>
  );
}
