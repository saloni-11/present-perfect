import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Header() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { path: '/upload', label: 'Home' },
    { path: '/about', label: 'About' },
  ];

  const isActive = path => location.pathname === path;

  const baseLink = {
    padding: '0.4rem 1rem',
    borderRadius: '1rem',
    border: '1px solid transparent',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
    display: 'inline-block',
  };

  const styles = {
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      borderBottom: '2px solid #5D2E8C',
      backgroundColor: '#f9f9ff',
      position: 'relative',
      zIndex: 1000,
    },
    leftGroup: { display: 'flex', alignItems: 'center', gap: '2rem' },
    logoContainer: { display: 'flex', alignItems: 'center', height: '30px' },
    logoImage: { height: '160%', objectFit: 'contain' },
    nav: { display: 'flex', gap: '1rem', alignItems: 'start', marginTop: '10px', fontSize: '16px' },
    drawerButton: { fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' },
    overlay: {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.3)', display: drawerOpen ? 'block' : 'none', zIndex: 1500,
    },
    drawer: {
      position: 'fixed', top: 0, left: 0, height: '100%', width: '250px',
      backgroundColor: '#f9f9ff', boxShadow: 'rgba(0, 0, 0, 0.3) 4px 0px 8px', padding: '2rem',
      display: 'flex', flexDirection: 'column', gap: '1rem',
      transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.3s ease-in-out', zIndex: 2000,
    },
  };

  const getLinkStyle = active => ({
    ...baseLink,
    backgroundColor: active ? '#5D2E8C' : 'transparent',
    color: active ? '#f9f9ff' : 'black',
    borderColor: active ? 'black' : 'transparent',
  });

  return (
    <>
      <header className="header" style={styles.header}>
        <div style={styles.leftGroup}>
          <div style={styles.logoContainer}>
            <img src={logo} alt="Present Perfect Logo" style={styles.logoImage} />
          </div>
          <nav style={styles.nav} className="nav">
            {navItems.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className="nav-link"
                style={getLinkStyle(isActive(path))}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <button
          className="drawer-button"
          style={styles.drawerButton}
          onClick={() => setDrawerOpen(o => !o)}
        >
          ☰
        </button>
      </header>

      <div style={styles.overlay} onClick={() => setDrawerOpen(false)} />

      <div style={styles.drawer} className="drawer">
        {navItems.map(({ path, label }) => (
          <Link
            key={path}
            to={path}
            className="nav-link"
            style={getLinkStyle(isActive(path))}
            onClick={() => setDrawerOpen(false)}
          >
            {label}
          </Link>
        ))}
      </div>

      <style>
        {`
          .drawer-button { display: none; }

          @media (max-width: 768px) {
            .nav { display: none !important; }
            .drawer-button { display: block !important; }
          }

          .nav-link { box-sizing: border-box; }

          .drawer .nav-link {
            display: block;
            width: 100%;
            text-align: left;
            border: none !important;
          }

          .nav-link:hover {
            background-color: rgba(93, 46, 140, 0.84) !important;
            color: #f9f9ff !important;
          }
          .nav-link:active {
            filter: brightness(85%) !important;
          }
        `}
      </style>
    </>
  );
}
