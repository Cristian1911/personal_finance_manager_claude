export function PrivacyContentEs() {
  return (
    <>
      <p>
        Zeta (&quot;nosotros&quot;, &quot;la app&quot;) respeta tu privacidad. Este documento
        describe qué datos personales recolectamos, cómo los usamos y qué
        derechos tienes sobre ellos bajo la Ley Estatutaria 1581 de 2012 de
        Colombia (Habeas Data) y el GDPR cuando aplique.
      </p>

      <h2>1. Qué datos recolectamos</h2>
      <ul>
        <li>
          <strong>Identificadores:</strong> correo electrónico, identificador único
          de usuario (UUID), fecha de creación de cuenta.
        </li>
        <li>
          <strong>Información financiera:</strong> transacciones, saldos, cuentas
          bancarias vinculadas (alias definidos por ti), categorías,
          destinatarios, presupuestos, metas de deuda.
        </li>
        <li>
          <strong>Contenido generado por ti:</strong> etiquetas, notas,
          descripciones de transacciones, configuración de recordatorios.
        </li>
        <li>
          <strong>Metadatos técnicos:</strong> versión de la app, sistema
          operativo, tipo de dispositivo. Usados para diagnóstico, no para
          rastreo publicitario.
        </li>
      </ul>
      <p>
        <strong>No recolectamos:</strong> contraseñas bancarias, datos
        biométricos (Face ID/Touch ID se valida localmente en tu dispositivo),
        ubicación, contactos, ni navegación fuera de Zeta.
      </p>

      <h2>2. Cómo usamos tus datos</h2>
      <ul>
        <li>
          Proveer la funcionalidad principal: importar extractos, categorizar,
          calcular presupuestos, proyectar deudas.
        </li>
        <li>Autenticar tu cuenta y mantener tu sesión.</li>
        <li>Enviar recordatorios y notificaciones que tú activas.</li>
        <li>
          Diagnosticar errores y mejorar la app (telemetría agregada sin datos
          identificables).
        </li>
      </ul>
      <p>
        <strong>No vendemos tus datos.</strong> No compartimos datos con
        anunciantes ni con terceros con fines comerciales.
      </p>

      <h2>3. Cómo protegemos tus datos</h2>
      <ul>
        <li>
          <strong>Cifrado en tránsito:</strong> toda comunicación entre la app y
          nuestros servidores usa HTTPS/TLS 1.2+.
        </li>
        <li>
          <strong>Cifrado en reposo:</strong> la información personal sensible
          (nombres, correos, descripciones de transacciones, destinatarios,
          saldos, contraseñas de PDF) está cifrada en la base de datos con
          sobre-cifrado basado en llaves por usuario. Ni siquiera nuestros
          administradores pueden leerla sin la llave del usuario.
        </li>
        <li>
          <strong>Aislamiento:</strong> políticas Row-Level Security (RLS)
          garantizan que cada usuario solo accede a sus propios registros.
        </li>
        <li>
          <strong>Sin rastreo cruzado:</strong> no usamos SDKs de rastreo
          publicitario ni cookies de terceros.
        </li>
      </ul>

      <h2>4. Tus derechos</h2>
      <p>Bajo la Ley 1581/2012 y el GDPR (cuando aplique), tienes derecho a:</p>
      <ul>
        <li>
          <strong>Acceso:</strong> ver qué datos tenemos sobre ti.
        </li>
        <li>
          <strong>Rectificación:</strong> corregir datos inexactos.
        </li>
        <li>
          <strong>Supresión:</strong> solicitar la eliminación de tu cuenta y
          datos asociados.
        </li>
        <li>
          <strong>Portabilidad:</strong> exportar tus datos en formato legible.
        </li>
        <li>
          <strong>Revocación del consentimiento:</strong> en cualquier momento.
        </li>
      </ul>
      <p>
        Para ejercer estos derechos, escribe a{" "}
        <a href="mailto:giraldo.0302@gmail.com">giraldo.0302@gmail.com</a>. Responderemos en
        un plazo máximo de 15 días hábiles.
      </p>

      <h2>5. Retención y eliminación</h2>
      <p>
        Conservamos tus datos mientras mantengas una cuenta activa. Al eliminar
        tu cuenta, borramos tus datos personales en un plazo de 30 días. Datos
        agregados no identificables pueden conservarse con fines estadísticos.
      </p>

      <h2>6. Menores de edad</h2>
      <p>
        Zeta no está dirigido a menores de 18 años. No recolectamos
        intencionalmente datos de menores. Si detectamos una cuenta de un menor,
        la eliminaremos.
      </p>

      <h2>7. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política. Los cambios materiales se comunicarán
        en la app y por correo electrónico antes de entrar en vigor.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Responsable del tratamiento:{" "}
        <a href="mailto:giraldo.0302@gmail.com">giraldo.0302@gmail.com</a>.
      </p>
      <p>
        Para reclamos ante la autoridad de protección de datos en Colombia,
        puedes contactar a la Superintendencia de Industria y Comercio (SIC) en{" "}
        <a
          href="https://www.sic.gov.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.sic.gov.co
        </a>
        .
      </p>
    </>
  );
}

export function PrivacyContentEn() {
  return (
    <>
      <p>
        Zeta (&quot;we&quot;, &quot;the app&quot;) respects your privacy. This document
        describes what personal data we collect, how we use it, and your rights
        under Colombia&apos;s Ley Estatutaria 1581 of 2012 (Habeas Data) and GDPR
        when applicable.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Identifiers:</strong> email address, unique user ID (UUID),
          account creation date.
        </li>
        <li>
          <strong>Financial information:</strong> transactions, balances, linked
          bank accounts (aliases you choose), categories, recipients, budgets,
          debt goals.
        </li>
        <li>
          <strong>User-generated content:</strong> tags, notes, transaction
          descriptions, reminder settings.
        </li>
        <li>
          <strong>Technical metadata:</strong> app version, operating system,
          device type. Used for diagnostics, not for ad tracking.
        </li>
      </ul>
      <p>
        <strong>We do not collect:</strong> bank passwords, biometric data (Face
        ID/Touch ID is validated locally on your device), location, contacts, or
        browsing activity outside Zeta.
      </p>

      <h2>2. How we use your data</h2>
      <ul>
        <li>
          Provide core functionality: import statements, categorize, compute
          budgets, project debt.
        </li>
        <li>Authenticate your account and keep your session active.</li>
        <li>Send reminders and notifications you enable.</li>
        <li>
          Diagnose errors and improve the app (aggregated telemetry, no
          personally identifiable data).
        </li>
      </ul>
      <p>
        <strong>We do not sell your data.</strong> We do not share data with
        advertisers or third parties for commercial purposes.
      </p>

      <h2>3. How we protect your data</h2>
      <ul>
        <li>
          <strong>In transit:</strong> all communication between the app and our
          servers uses HTTPS/TLS 1.2+.
        </li>
        <li>
          <strong>At rest:</strong> sensitive personal information (names,
          emails, transaction descriptions, recipients, balances, PDF passwords)
          is encrypted in the database with envelope encryption using per-user
          keys. Even our administrators cannot read it without the user&apos;s
          key.
        </li>
        <li>
          <strong>Isolation:</strong> Row-Level Security (RLS) policies ensure
          each user only accesses their own records.
        </li>
        <li>
          <strong>No cross-tracking:</strong> we do not use ad-tracking SDKs or
          third-party cookies.
        </li>
      </ul>

      <h2>4. Your rights</h2>
      <p>Under Law 1581/2012 and GDPR (where applicable), you have the right to:</p>
      <ul>
        <li>
          <strong>Access:</strong> see what data we hold about you.
        </li>
        <li>
          <strong>Rectification:</strong> correct inaccurate data.
        </li>
        <li>
          <strong>Erasure:</strong> request deletion of your account and
          associated data.
        </li>
        <li>
          <strong>Portability:</strong> export your data in a readable format.
        </li>
        <li>
          <strong>Consent withdrawal:</strong> at any time.
        </li>
      </ul>
      <p>
        To exercise these rights, email{" "}
        <a href="mailto:giraldo.0302@gmail.com">giraldo.0302@gmail.com</a>. We respond
        within 15 business days.
      </p>

      <h2>5. Retention and deletion</h2>
      <p>
        We retain your data while your account is active. When you delete your
        account, we erase your personal data within 30 days. Aggregated,
        non-identifiable data may be retained for statistical purposes.
      </p>

      <h2>6. Minors</h2>
      <p>
        Zeta is not directed at children under 18. We do not knowingly collect
        data from minors. If we detect a minor&apos;s account, we will delete
        it.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy. Material changes will be communicated in the
        app and via email before they take effect.
      </p>

      <h2>8. Contact</h2>
      <p>
        Data controller:{" "}
        <a href="mailto:giraldo.0302@gmail.com">giraldo.0302@gmail.com</a>.
      </p>
      <p>
        For complaints with the Colombian data protection authority, you may
        contact Superintendencia de Industria y Comercio (SIC) at{" "}
        <a
          href="https://www.sic.gov.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.sic.gov.co
        </a>
        .
      </p>
    </>
  );
}
