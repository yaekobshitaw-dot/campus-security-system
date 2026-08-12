// src/components/Footer.jsx
import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.content}>
          {/* Left Section */}
          <div style={styles.section}>
            <h3 style={styles.title}>🛡️ Campus Security</h3>
            <p style={styles.description}>
              Emergency Response System for Campus Safety
            </p>
            <div style={styles.socialLinks}>
              <a href="#" style={styles.socialLink}>📱</a>
              <a href="#" style={styles.socialLink}>🐦</a>
              <a href="#" style={styles.socialLink}>📘</a>
              <a href="#" style={styles.socialLink}>📷</a>
            </div>
          </div>

          {/* Quick Links */}
          <div style={styles.section}>
            <h4 style={styles.heading}>Quick Links</h4>
            <ul style={styles.list}>
              <li><a href="/dashboard" style={styles.link}>Dashboard</a></li>
              <li><a href="/incidents" style={styles.link}>Incidents</a></li>
              <li><a href="/report" style={styles.link}>Report Incident</a></li>
              <li><a href="/alerts" style={styles.link}>Alerts</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div style={styles.section}>
            <h4 style={styles.heading}>Resources</h4>
            <ul style={styles.list}>
              <li><a href="/safety-tips" style={styles.link}>Safety Tips</a></li>
              <li><a href="/emergency-contacts" style={styles.link}>Emergency Contacts</a></li>
              <li><a href="/evacuation" style={styles.link}>Evacuation Routes</a></li>
              <li><a href="/help" style={styles.link}>Help & Support</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div style={styles.section}>
            <h4 style={styles.heading}>Emergency Contacts</h4>
            <div style={styles.contact}>
              <p>📞 <strong>Security:</strong> +251-911-234-567</p>
              <p>🚑 <strong>Medical:</strong> +251-911-765-432</p>
              <p>🚒 <strong>Fire:</strong> +251-911-987-654</p>
              <p>📧 <strong>Email:</strong> security@campus.edu</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={styles.bottomBar}>
          <div style={styles.bottomContent}>
            <span>© {currentYear} Campus Security System. All rights reserved.</span>
            <div style={styles.bottomLinks}>
              <a href="/privacy" style={styles.bottomLink}>Privacy Policy</a>
              <a href="/terms" style={styles.bottomLink}>Terms of Service</a>
              <a href="/cookies" style={styles.bottomLink}>Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    marginTop: '40px',
    paddingTop: '40px',
    fontFamily: 'Arial, sans-serif'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '30px',
    paddingBottom: '30px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  section: {
    display: 'flex',
    flexDirection: 'column'
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#4FC3F7'
  },
  description: {
    fontSize: '14px',
    color: '#b0b0b0',
    marginBottom: '15px',
    lineHeight: '1.6'
  },
  socialLinks: {
    display: 'flex',
    gap: '12px'
  },
  socialLink: {
    display: 'inline-block',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '18px'
  },
  heading: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#ffffff'
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  link: {
    color: '#b0b0b0',
    textDecoration: 'none',
    display: 'block',
    padding: '5px 0',
    fontSize: '14px'
  },
  contact: {
    fontSize: '14px',
    color: '#b0b0b0',
    lineHeight: '1.8'
  },
  bottomBar: {
    padding: '20px 0',
    marginTop: '20px'
  },
  bottomContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    fontSize: '13px',
    color: '#888'
  },
  bottomLinks: {
    display: 'flex',
    gap: '20px'
  },
  bottomLink: {
    color: '#888',
    textDecoration: 'none',
    fontSize: '13px'
  }
};

export default Footer;
