import Link from "next/link";
import "./landing.css";
import { FooterYear, LandingBehaviors, LandingDemo } from "./landing-demo";
import { startDemoSession, startGuestSession } from "@/actions/demo";

export function MarketingLandingPage() {
  return (
    <div className="zeta-landing">
      <LandingBehaviors />

      {/* ========================================= NAV */}
      <nav className="nav" id="zeta-landing-nav">
        <div className="z-container nav-inner">
          <Link href="/" className="brand" aria-label="Zeta">
            <span className="brand-mark">Z</span>
            <span>Zeta</span>
          </Link>
          <div className="nav-links">
            <a href="#features">Producto</a>
            <a href="#demo">Cómo funciona</a>
            <a href="#privacy">Privacidad</a>
          </div>
          <div className="nav-actions">
            <Link href="/login" className="nav-login">
              Iniciar sesión
            </Link>
            <Link href="/signup" className="nav-cta">
              Crear cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* ========================================= HERO */}
      <section className="hero">
        <div className="z-container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" />
              Zeta · beta privada
            </div>
            <h1 className="hero-title">
              Tu plata,
              <br />
              <em>sin ruido.</em>
            </h1>
            <p className="hero-sub">
              Una app de finanzas personales para quienes odian las apps de finanzas personales.
              Silenciosa, honesta, hecha para saber si vas bien — no para convencerte de que sí.
            </p>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-primary">
                Crear cuenta
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M2 7h10M8 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Iniciar sesión
              </Link>
              <form action={startDemoSession} className="contents">
                <button type="submit" className="btn btn-ghost">
                  Ver demo
                </button>
              </form>
              <form action={startGuestSession} className="contents">
                <button type="submit" className="btn btn-ghost">
                  Usar sin cuenta
                </button>
              </form>
            </div>
            <div className="hero-micro">
              <span className="pulse" />
              Gratis · sin tarjeta · prueba sin crear cuenta
            </div>
          </div>

          <div className="phone-wrap">
            <div className="float-card top-left">
              <div
                className="ic"
                style={{ background: "rgba(147,120,68,0.18)", color: "var(--z-brass)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M2 7l3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="ttl">4 categorizados</div>
                <div className="sub">38 seg</div>
              </div>
            </div>

            <div className="float-card bottom-right">
              <div
                className="ic"
                style={{ background: "rgba(61,158,110,0.18)", color: "var(--z-income)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M7 4v3l2 1.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <div className="ttl">Vas $ 12k arriba</div>
                <div className="sub">vs promedio · 10d restantes</div>
              </div>
            </div>

            <div className="phone">
              <div className="phone-screen">
                <div className="phone-notch" />
                <div className="ph-status">
                  <span>9:41</span>
                  <span>●●●●</span>
                </div>

                <div className="ph-head">
                  <div>
                    <h2>Zeta</h2>
                    <div className="sub">Vie · 17 Abr</div>
                  </div>
                  <span className="ph-edit">Editar</span>
                </div>

                <div className="ph-pulse">
                  <span className="chip-status">
                    <span className="cs-dot" />
                    Vas bien
                  </span>
                  <div className="eyebrow pulse-eyebrow">Este mes · pulso</div>
                  <div className="pulse-big">
                    <span className="n tnum">$ 114k</span>
                    <span className="u">/día</span>
                  </div>
                  <div className="pulse-meta">10 días · Abril</div>
                  <div className="pulse-spark">
                    <svg
                      viewBox="0 0 280 40"
                      preserveAspectRatio="none"
                      style={{ width: "100%", height: 40 }}
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="zeta-hero-spark" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0" stopColor="#937844" stopOpacity="0.35" />
                          <stop offset="1" stopColor="#937844" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M4,30 L32,26 L60,30 L90,22 L120,20 L152,14 L184,16 L216,10 L248,8 L276,6"
                        stroke="#937844"
                        strokeWidth="2.4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4,30 L32,26 L60,30 L90,22 L120,20 L152,14 L184,16 L216,10 L248,8 L276,6 L276,40 L4,40 Z"
                        fill="url(#zeta-hero-spark)"
                      />
                      <circle cx="276" cy="6" r="3.5" fill="#937844" stroke="#121412" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                <div className="ph-sec">
                  <span className="lbl">Te esperan</span>
                  <span className="rule" />
                </div>
                <div className="ph-list">
                  <div className="row primary">
                    <div className="txt">
                      <span>Categorizar</span>
                      <span className="hint">~40 seg · 4 mov.</span>
                    </div>
                    <span className="amt">4</span>
                  </div>
                  <div className="row">
                    <div className="txt">
                      <span>Visa ••7022 vence</span>
                      <span className="hint">en 21 días</span>
                    </div>
                    <span className="amt" style={{ color: "var(--z-expense)" }}>
                      !
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================= TRUST */}
      <section className="trust">
        <div className="z-container trust-inner reveal">
          <div className="trust-label">
            Sin conexión bancaria. Sin credenciales.
            <br />
            Tu plata entra como quieras — PDF, correo, foto, manual.
          </div>
          <div className="trust-banks">
            <span className="bank-chip">Extracto PDF</span>
            <span className="bank-chip">Reenviar correo</span>
            <span className="bank-chip">Foto del recibo</span>
            <span className="bank-chip">Captura rápida</span>
            <span className="bank-chip">Manual</span>
            <span className="bank-chip more">Tú decides qué compartir</span>
          </div>
        </div>
      </section>

      {/* ========================================= FEATURES */}
      <section className="features" id="features">
        <div className="z-container">
          <div className="section-head reveal">
            <div className="eyebrow">
              <span className="dot" />
              Lo que hace
            </div>
            <h2>
              Cuatro cosas que deberían ser <em>obvias.</em>
            </h2>
            <p>
              Empiezas con un PDF. Capturas lo que falta como te quede. Ves el plan del mes y las
              deudas en una sola vista. Sin conectar bancos, sin credenciales, sin ruido.
            </p>
          </div>

          <div className="feat-grid">
            {/* Feature 1 — PDF import */}
            <article className="feat reveal">
              <div className="feat-stage">
                <div className="vignette-pdf">
                  <div className="pdf-stack">
                    <div className="pdf-sheet">
                      <span className="pdf-corner" />
                      <div className="pdf-bank">EXTRACTO</div>
                      <div className="pdf-line" />
                      <div className="pdf-line short" />
                      <div className="pdf-line" />
                      <div className="pdf-line tiny" />
                      <div className="pdf-line short" />
                    </div>
                    <div className="pdf-sheet">
                      <span className="pdf-corner" />
                      <div className="pdf-bank">EXTRACTO</div>
                      <div className="pdf-line" />
                      <div className="pdf-line short" />
                      <div className="pdf-line" />
                      <div className="pdf-line tiny" />
                    </div>
                    <div className="pdf-sheet">
                      <span className="pdf-corner" />
                      <div className="pdf-bank">EXTRACTO · ABR</div>
                      <div className="pdf-line" />
                      <div className="pdf-line short" />
                      <div className="pdf-line" />
                      <div className="pdf-line tiny" />
                      <div className="pdf-line short" />
                    </div>
                  </div>
                  <div className="pdf-rows">
                    <div className="pdf-row" />
                    <div className="pdf-row" />
                    <div className="pdf-row" />
                    <div className="pdf-row" />
                    <div className="pdf-row" />
                  </div>
                </div>
              </div>
              <div className="feat-body">
                <div className="feat-kicker">
                  <span className="num">1</span>
                  Importar PDF
                </div>
                <h3>
                  Arrastra tu extracto. <em>Listo.</em>
                </h3>
                <p>
                  Sube el PDF de tu banco y Zeta extrae los movimientos, detecta duplicados y
                  reconstruye tu mes. Meses atrás también — sin conectar nada, sin credenciales.
                </p>
              </div>
            </article>

            {/* Feature 2 — Capture channels */}
            <article className="feat reveal" style={{ transitionDelay: ".08s" }}>
              <div className="feat-stage">
                <div className="vignette-capture">
                  <div className="cap-hub">
                    <svg
                      viewBox="0 0 220 160"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                      aria-hidden="true"
                    >
                      <path className="cap-arrow" d="M28,28 Q80,60 106,80" />
                      <path className="cap-arrow" d="M192,28 Q140,60 114,80" />
                      <path className="cap-arrow" d="M28,132 Q80,100 106,80" />
                      <path className="cap-arrow" d="M192,132 Q140,100 114,80" />
                      <circle className="cap-dot" r="2.5">
                        <animateMotion dur="2.4s" repeatCount="indefinite" path="M28,28 Q80,60 106,80" />
                      </circle>
                      <circle className="cap-dot" r="2.5">
                        <animateMotion dur="2.8s" repeatCount="indefinite" path="M192,28 Q140,60 114,80" />
                      </circle>
                      <circle className="cap-dot" r="2.5">
                        <animateMotion dur="2.6s" repeatCount="indefinite" path="M28,132 Q80,100 106,80" />
                      </circle>
                      <circle className="cap-dot" r="2.5">
                        <animateMotion dur="3s" repeatCount="indefinite" path="M192,132 Q140,100 114,80" />
                      </circle>
                    </svg>
                    <div className="cap-node tl" title="Correo">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                    </div>
                    <div className="cap-node tr" title="Foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </div>
                    <div className="cap-node bl" title="Captura rápida">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
                      </svg>
                    </div>
                    <div className="cap-node br" title="Manual">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 20h4l10-10-4-4L4 16z" />
                        <path d="M14 6l4 4" />
                      </svg>
                    </div>
                    <div className="cap-center">Z</div>
                  </div>
                </div>
              </div>
              <div className="feat-body">
                <div className="feat-kicker">
                  <span className="num">2</span>
                  Capturar
                </div>
                <h3>
                  Entra como <em>te quede</em>.
                </h3>
                <p>
                  Reenvía el correo del banco. Toma una foto del recibo. Dicta un gasto en 2
                  segundos. Escribe a mano. Cuatro rutas, un solo libro.
                </p>
              </div>
            </article>

            {/* Feature 3 — Plan mensual */}
            <article className="feat reveal" style={{ transitionDelay: ".16s" }}>
              <div className="feat-stage">
                <div className="vignette-plan">
                  <div className="env-row">
                    <span className="env-lbl">Comida</span>
                    <div className="env-bar" data-fill="78" />
                    <span className="env-amt">78%</span>
                  </div>
                  <div className="env-row">
                    <span className="env-lbl">Transp.</span>
                    <div className="env-bar soft" data-fill="54" />
                    <span className="env-amt">54%</span>
                  </div>
                  <div className="env-row">
                    <span className="env-lbl">Ocio</span>
                    <div className="env-bar" data-fill="92" />
                    <span className="env-amt">92%</span>
                  </div>
                  <div className="env-row">
                    <span className="env-lbl">Casa</span>
                    <div className="env-bar over" data-fill="105" />
                    <span className="env-amt warn">+5%</span>
                  </div>
                </div>
              </div>
              <div className="feat-body">
                <div className="feat-kicker">
                  <span className="num">3</span>
                  Plan del mes
                </div>
                <h3>
                  Sobres que se llenan <em>solos</em>.
                </h3>
                <p>
                  Pon un tope por categoría al empezar el mes. Cada movimiento va al sobre que le
                  toca. Ves en qué vas sin hacer cuentas — y qué sobre se está apretando.
                </p>
              </div>
            </article>

            {/* Feature 4 — Deudas */}
            <article className="feat reveal" style={{ transitionDelay: ".24s" }}>
              <div className="feat-stage">
                <div className="vignette-debt">
                  <div className="debt-row">
                    <div>
                      <div className="debt-name">Visa ••7022</div>
                      <div className="debt-days urgent">Vence en 6 días</div>
                    </div>
                    <span className="debt-amt tnum">$ 1.8M</span>
                    <div className="debt-track" data-fill="90" />
                  </div>
                  <div className="debt-row">
                    <div>
                      <div className="debt-name">Préstamo auto</div>
                      <div className="debt-days">12 de 24 cuotas</div>
                    </div>
                    <span className="debt-amt tnum">$ 8.4M</span>
                    <div className="debt-track" data-fill="55" />
                  </div>
                  <div className="debt-row">
                    <div>
                      <div className="debt-name">Master ••3101</div>
                      <div className="debt-days">Vence en 19 días</div>
                    </div>
                    <span className="debt-amt tnum">$ 420k</span>
                    <div className="debt-track" data-fill="25" />
                  </div>
                </div>
              </div>
              <div className="feat-body">
                <div className="feat-kicker">
                  <span className="num">4</span>
                  Deudas
                </div>
                <h3>
                  Cuánto debes, <em>cuándo</em>.
                </h3>
                <p>
                  Todas tus deudas en una línea: saldo, cuota, fecha de corte y cuánto te falta.
                  Zeta avisa antes — no después.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ========================================= DEMO */}
      <section className="demo" id="demo">
        <div className="z-container">
          <div className="demo-head reveal">
            <div className="eyebrow">
              <span className="dot" />
              Demo en vivo
            </div>
            <h2>
              Mueve el día. <em>Siente el pulso.</em>
            </h2>
            <p>
              Así se ve Zeta cuando te dice si vas bien. Desliza para adelantar el mes y mira cómo
              cambia la respuesta.
            </p>
          </div>

          <LandingDemo />
        </div>
      </section>

      {/* ========================================= CTA */}
      <section className="cta-band" id="signup">
        <div className="z-container cta-inner reveal">
          <h2>
            Plata con <em>calma.</em>
          </h2>
          <p>
            Crea tu cuenta gratis. Empieza con tu último extracto en PDF y mira cómo se ve tu mes
            en Zeta. Sin tarjeta, sin cadenas.
          </p>
          <div className="cta-actions">
            <Link href="/signup" className="btn btn-primary">
              Crear cuenta
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2 7h10M8 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Iniciar sesión
            </Link>
          </div>
          <div className="cta-stores">
            <a
              href="https://apps.apple.com/co/app/zeta-finanzas-personales/id6763683831"
              target="_blank"
              rel="noopener noreferrer"
              className="store-badge"
              aria-label="Descargar en App Store"
            >
              <svg className="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <div className="txt">
                <span className="s">Descargar en</span>
                <span className="b">App Store</span>
              </div>
            </a>
            <a
              href="https://play.google.com/apps/testing/com.venti5.zeta"
              target="_blank"
              rel="noopener noreferrer"
              className="store-badge"
              aria-label="Únete a la beta en Google Play"
            >
              <svg className="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.6 2.1c-.37.4-.6.99-.6 1.75v16.3c0 .77.23 1.36.62 1.75L12 13.51v-.99L3.6 2.1zm10.6 10.36l-2.79 2.79 8.86 5.04c.97-.18 1.73-1.09 1.73-2.08 0-.66-.4-1.28-1-1.58l-6.8-4.17zm6.8-4.75c.6-.3 1-.92 1-1.58 0-.99-.76-1.9-1.73-2.08L11.4 9.08l2.81 2.84 6.79-3.9v-.31zM4.37 22.2l8.94-5.12-2.82-2.82L4.37 22.2z" />
              </svg>
              <div className="txt">
                <span className="s">Únete a la beta en</span>
                <span className="b">Google Play</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================= FOOTER */}
      <footer className="footer" id="privacy">
        <div className="z-container footer-inner">
          <div className="footer-brand">
            <span className="brand-mark">Z</span>
            <span>Zeta</span>
          </div>
          <div className="footer-legal">
            <a href="#">Privacidad</a>
            <a href="#">Términos</a>
            <a href="#">Seguridad</a>
          </div>
          <div className="footer-copy">
            © <FooterYear /> · Hecho con calma
          </div>
        </div>
      </footer>
    </div>
  );
}
