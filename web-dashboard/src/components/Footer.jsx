// src/components/Footer.jsx

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="dashboard-footer">
      <div className="dashboard-footer-inner">
        <div className="dashboard-footer-grid">
          <div className="dashboard-footer-brand">
            <span className="dashboard-footer-mark">S</span>
            <div>
              <strong>CampusSecure</strong>
              <p>Emergency response system for campus safety.</p>
            </div>
          </div>

          <div className="dashboard-footer-group">
            <h4>Quick links</h4>
            <ul>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/incidents/active">Active incidents</a></li>
              <li><a href="/sos">Emergency alerts</a></li>
              <li><a href="/evidence">Evidence</a></li>
            </ul>
          </div>

          <div className="dashboard-footer-group">
            <h4>Emergency contacts</h4>
            <ul className="dashboard-contact-list">
              <li><span>Security</span><strong>+251-911-234-567</strong></li>
              <li><span>Medical</span><strong>+251-911-765-432</strong></li>
              <li><span>Fire</span><strong>+251-911-987-654</strong></li>
            </ul>
          </div>
        </div>

        <div className="dashboard-footer-bottom">
          <span>© {currentYear} CampusSecure</span>
          <span>Secure Operations Center</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
