import {
  ArrowRight,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import logo from '../assets/Spartan_BTY_logo.webp';

import {
  colors,
  font,
} from '../styles/tokens';

export default function Landing() {
  return (
    <div className="landing-page">
      <style>{landingStyles}</style>

      <header className="landing-header">
        <div className="landing-header-inner">
          <Link
            to="/"
            className="landing-brand"
            aria-label="Spartan BTY home"
          >
            <img
              src={logo}
              alt="Spartan BTY Inc. logo"
              className="landing-logo"
            />

            <span className="landing-brand-name">
              Spartan{' '}
              <span>BTY</span>
            </span>
          </Link>

          <Link
            to="/login"
            className="landing-login-button"
          >
            Staff Login
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />

          <div className="landing-hero-content">
            <p className="landing-eyebrow">
              ESTABLISHED 2018 · IMUS,
              CAVITE
            </p>

            <h1 className="landing-hero-title">
              Skin that speaks
              <br />
              for itself.
            </h1>

            <p className="landing-hero-description">
              Spartan BTY Inc. is a
              beauty and cosmetics company
              committed to organized,
              quality-focused operations
              and dependable customer
              service.
            </p>

            <div className="landing-restricted-note">
              <ShieldCheck size={17} />

              <span>
                The management system is
                restricted to authorized
                Spartan BTY personnel.
              </span>
            </div>
          </div>
        </section>

        <section className="landing-about-section">
          <div className="landing-about-grid">
            <div className="landing-about-heading">
              <p className="landing-section-label">
                ABOUT THE COMPANY
              </p>

              <h2>
                A growing local beauty
                and cosmetics brand
              </h2>
            </div>

            <div className="landing-about-content">
              <p>
                Spartan BTY Inc. began in
                2018 with a self-formulated
                fragrance developed in
                Imus, Cavite. The company
                later expanded into
                skincare and cosmetics
                products while maintaining
                its focus on product
                quality and customer
                experience.
              </p>

              <p>
                As the company continued
                to grow, its daily
                operations required a
                more organized approach
                to managing business
                information, coordinating
                responsibilities, and
                monitoring ongoing
                activities.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-mis-section">
          <div className="landing-mis-content">
            <div>
              <p className="landing-section-label">
                INTERNAL MANAGEMENT SYSTEM
              </p>

              <h2>
                Supporting organized
                business operations
              </h2>

              <p>
                The Web-Based Management
                Information System
                provides authorized
                personnel with an
                integrated platform for
                recording information,
                coordinating workflows,
                monitoring operational
                activities, and generating
                management reports.
              </p>
            </div>

            <div className="landing-location-card">
              <MapPin size={22} />

              <div>
                <strong>
                  Spartan BTY Inc.
                </strong>

                <p>
                  Tamsui Avenue,
                  Bayan Luma II,
                  Imus, Cavite 4103
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <strong>
              Spartan BTY Inc.
            </strong>

            <p>
              Web-Based MIS
            </p>
          </div>

          <p className="landing-footer-copy">
            ©{' '}
            {new Date().getFullYear()}{' '}
            Spartan BTY Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}

const landingStyles = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
  }

  .landing-page {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    background: #ffffff;
    color: ${colors.ink};
    font-family: ${font.body};
  }

  .landing-header {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    border-bottom: 1px solid ${colors.border};
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(12px);
  }

  .landing-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: min(100%, 1180px);
    min-height: 72px;
    margin: 0 auto;
    padding: 8px 16px;
  }

  .landing-brand {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    color: ${colors.ink};
    text-decoration: none;
  }

  .landing-logo {
    display: block;
    width: 50px;
    height: 50px;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .landing-brand-name {
    margin-left: 8px;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
  }

  .landing-brand-name span {
    color: ${colors.roseDeep};
  }

  .landing-login-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    gap: 7px;
    padding: 0 15px;
    border-radius: 9px;
    background: ${colors.roseDeep};
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease;
  }

  .landing-login-button:hover {
    transform: translateY(-1px);
    box-shadow:
      0 10px 24px
      rgba(127, 52, 71, 0.2);
  }

  .landing-hero {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 610px;
    overflow: hidden;
    padding: 76px 20px;
    background: ${colors.blush};
    text-align: center;
  }

  .hero-glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .hero-glow-one {
    top: -150px;
    left: 50%;
    width: 520px;
    height: 520px;
    transform: translateX(-50%);
    background:
      radial-gradient(
        circle,
        ${colors.rose}58 0%,
        ${colors.rose}00 70%
      );
  }

  .hero-glow-two {
    right: -140px;
    bottom: -170px;
    width: 360px;
    height: 360px;
    border: 1px dashed ${colors.rose}55;
  }

  .landing-hero-content {
    position: relative;
    z-index: 2;
    width: min(100%, 760px);
  }

  .landing-eyebrow {
    margin: 0 0 22px;
    color: ${colors.roseDeep};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
  }

  .landing-hero-title {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: clamp(44px, 13vw, 68px);
    font-weight: 500;
    line-height: 1.03;
    letter-spacing: -1.4px;
  }

  .landing-hero-description {
    max-width: 62ch;
    margin: 24px auto 0;
    color: ${colors.mutedInk};
    font-size: 15px;
    line-height: 1.7;
  }

  .landing-restricted-note {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 520px;
    gap: 9px;
    margin-top: 28px;
    padding: 11px 15px;
    border: 1px solid ${colors.border};
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.62);
    color: ${colors.roseDeep};
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }

  .landing-about-section {
    padding: 72px 18px;
    background: #ffffff;
  }

  .landing-about-grid {
    display: grid;
    grid-template-columns: 1fr;
    width: min(100%, 1040px);
    gap: 28px;
    margin: 0 auto;
  }

  .landing-section-label {
    margin: 0 0 12px;
    color: ${colors.roseDeep};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
  }

  .landing-about-heading h2,
  .landing-mis-content h2 {
    max-width: 18ch;
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 30px;
    font-weight: 500;
    line-height: 1.2;
  }

  .landing-about-content {
    display: grid;
    gap: 17px;
  }

  .landing-about-content p {
    max-width: 68ch;
    margin: 0;
    color: ${colors.mutedInk};
    font-size: 14px;
    line-height: 1.75;
  }

  .landing-mis-section {
    padding: 72px 18px;
    background: ${colors.ink};
    color: #ffffff;
  }

  .landing-mis-content {
    display: grid;
    grid-template-columns: 1fr;
    width: min(100%, 1040px);
    gap: 34px;
    margin: 0 auto;
  }

  .landing-mis-content h2 {
    color: #ffffff;
  }

  .landing-mis-content > div > p:last-child {
    max-width: 66ch;
    margin: 18px 0 0;
    color: rgba(255, 255, 255, 0.68);
    font-size: 14px;
    line-height: 1.75;
  }

  .landing-location-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.06);
  }

  .landing-location-card svg {
    flex: 0 0 auto;
    color: ${colors.rose};
  }

  .landing-location-card strong {
    color: #ffffff;
    font-family: ${font.display};
    font-size: 18px;
    font-weight: 600;
  }

  .landing-location-card p {
    max-width: 38ch;
    margin: 7px 0 0;
    color: rgba(255, 255, 255, 0.64);
    font-size: 13px;
    line-height: 1.65;
  }

  .landing-footer {
    padding: 27px 18px;
    background: #20191b;
    color: #ffffff;
  }

  .landing-footer-inner {
    display: flex;
    flex-direction: column;
    width: min(100%, 1180px);
    gap: 17px;
    margin: 0 auto;
  }

  .landing-footer strong {
    font-family: ${font.display};
    font-size: 17px;
    font-weight: 600;
  }

  .landing-footer p {
    max-width: 65ch;
    margin: 6px 0 0;
    color: rgba(255, 255, 255, 0.57);
    font-size: 11px;
    line-height: 1.6;
  }

  .landing-footer-copy {
    margin: 0 !important;
  }

  @media (min-width: 600px) {
    .landing-header-inner {
      padding-inline: 28px;
    }

    .landing-footer-inner {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
    }
  }

  @media (min-width: 768px) {
    .landing-header-inner {
      min-height: 80px;
      padding-inline: 40px;
    }

    .landing-logo {
      width: 58px;
      height: 58px;
    }

    .landing-brand-name {
      font-size: 20px;
    }

    .landing-hero {
      min-height: 660px;
      padding: 100px 40px;
    }

    .landing-about-section,
    .landing-mis-section {
      padding: 92px 40px;
    }

    .landing-about-grid {
      grid-template-columns:
        minmax(0, 0.85fr)
        minmax(0, 1.15fr);
      gap: 70px;
    }

    .landing-mis-content {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(280px, 0.72fr);
      align-items: center;
      gap: 70px;
    }
  }

  @media (max-width: 420px) {
    .landing-brand-name {
      font-size: 16px;
    }

    .landing-logo {
      width: 45px;
      height: 45px;
    }

    .landing-login-button {
      padding-inline: 11px;
      font-size: 11px;
    }

    .landing-restricted-note {
      align-items: flex-start;
      border-radius: 12px;
      text-align: left;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
    }
  }
`;