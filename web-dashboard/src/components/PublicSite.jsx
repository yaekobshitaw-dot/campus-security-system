import ArrowRight from '@mui/icons-material/ArrowForward';
import CheckCircle2 from '@mui/icons-material/CheckCircleOutline';
import ChevronRight from '@mui/icons-material/ChevronRight';
import X from '@mui/icons-material/Close';
import LayoutDashboard from '@mui/icons-material/Dashboard';
import FileText from '@mui/icons-material/Description';
import Mail from '@mui/icons-material/Email';
import MapPin from '@mui/icons-material/LocationOn';
import LockKeyhole from '@mui/icons-material/Lock';
import Menu from '@mui/icons-material/Menu';
import BellRing from '@mui/icons-material/NotificationsActive';
import Phone from '@mui/icons-material/Phone';
import BrainCircuit from '@mui/icons-material/Psychology';
import Radar from '@mui/icons-material/Radar';
import Siren from '@mui/icons-material/ReportProblem';
import ShieldCheck from '@mui/icons-material/Security';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './public.css';

const features = [
  { icon: FileText, title: 'Real-Time Incident Reporting', text: 'Capture what happened, where it happened, and who needs help in seconds.' },
  { icon: Siren, title: 'Emergency Response', text: 'Route urgent reports to the right response team with clear severity signals.' },
  { icon: BrainCircuit, title: 'AI-Powered Threat Recognition', text: 'Use intelligent signals to help teams identify patterns and prioritize action.' },
  { icon: MapPin, title: 'Location-Based Reporting', text: 'Give responders precise campus context so they can arrive prepared.' },
  { icon: BellRing, title: 'Security Alerts & Notifications', text: 'Keep campus communities informed with timely, relevant safety updates.' },
  { icon: LockKeyhole, title: 'Role-Based Access Control', text: 'Give students, staff, security, and administrators the access they need.' },
  { icon: Radar, title: 'Incident Tracking', text: 'Follow every report from first signal through investigation and resolution.' },
  { icon: LayoutDashboard, title: 'Analytics & Safety Monitoring', text: 'Turn incident data into a clearer view of campus safety over time.' }
];

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Features' },
  { to: '/contact', label: 'Contact' }
];

function PublicNav({ user, onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="public-nav-wrap">
      <nav className="public-nav" aria-label="Main navigation">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><ShieldCheck size={22} /></span>
          <span>Campus<span>Secure</span></span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`nav-links ${open ? 'is-open' : ''}`}>
          {navLinks.map((link) => <Link key={link.to} to={link.to} onClick={() => setOpen(false)}>{link.label}</Link>)}
          {user ? (
            <>
              <Link className="nav-dashboard" to="/dashboard" onClick={() => setOpen(false)}><LayoutDashboard size={16} /> Dashboard</Link>
              <button className="nav-logout" onClick={() => { setOpen(false); onLogout(); }}>Log out</button>
            </>
          ) : (
            <>
              <Link className="nav-login" to="/login" onClick={() => setOpen(false)}>Log in</Link>
              <Link className="nav-register" to="/register" onClick={() => setOpen(false)}>Create account <ArrowRight size={15} /></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-grid">
        <div>
          <Link to="/" className="brand footer-brand"><span className="brand-mark"><ShieldCheck size={22} /></span><span>Campus<span>Secure</span></span></Link>
          <p className="footer-intro">A calmer, faster way to coordinate safety across the places where campus life happens.</p>
        </div>
        <div><h3>Explore</h3><Link to="/about">About us</Link><Link to="/features">Features</Link><Link to="/contact">Contact</Link></div>
        <div><h3>For campus teams</h3><Link to="/login">Sign in</Link><Link to="/register">Join the platform</Link><span>Incident response</span></div>
        <div className="footer-emergency"><h3>Need urgent help?</h3><p>For immediate emergencies, use your university&apos;s established emergency channel.</p><Link to="/contact">View contact guidance <ChevronRight size={15} /></Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} CampusSecure</span><span>Built for safer campus communities.</span></div>
    </footer>
  );
}

function HomePage() {
  return <>
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow"><span className="status-dot" /> Campus safety, connected</p>
        <h1>Smart security for <em>every</em> campus moment.</h1>
        <p className="hero-subtitle">A unified emergency response system that helps students, faculty, staff, and security teams report incidents quickly and act with confidence.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/login">Report an incident <ArrowRight size={18} /></Link><Link className="button button-quiet" to="/about">Learn more <ChevronRight size={17} /></Link></div>
        <div className="hero-proof"><div><strong>24/7</strong><span>response ready</span></div><div><strong>01</strong><span>shared safety view</span></div><div><strong>100%</strong><span>role-aware access</span></div></div>
      </div>
      <div className="hero-visual" aria-label="Campus security operations visual">
        <div className="visual-image" />
        <div className="visual-overlay" />
        <div className="visual-panel panel-alert"><span className="panel-icon"><Siren size={17} /></span><span><strong>Response team notified</strong><small>North quad · 2 min ago</small></span><CheckCircle2 size={18} /></div>
        <div className="visual-panel panel-status"><span className="radar-icon"><Radar size={22} /></span><span><strong>Campus watch</strong><small>All systems operational</small></span><span className="live-label">LIVE</span></div>
        <div className="visual-caption"><span>01</span><span>Watchful by design</span></div>
      </div>
    </section>
    <section className="trust-strip"><span>One system for</span><strong>Students</strong><strong>Faculty</strong><strong>Staff</strong><strong>Security teams</strong><strong>Campus leaders</strong></section>
    <section className="section feature-preview"><div className="section-heading"><div><p className="eyebrow">Built around response</p><h2>Safety tools that move<br /><em>at campus speed.</em></h2></div><Link className="text-link" to="/features">Explore all features <ArrowRight size={16} /></Link></div><div className="feature-grid">{features.slice(0, 4).map((feature) => <FeatureCard key={feature.title} {...feature} />)}</div></section>
    <section className="emergency-band"><div><p className="eyebrow">When every second counts</p><h2>Make the next right action easier.</h2></div><Link className="button button-light" to="/contact">Get in touch <ArrowRight size={17} /></Link></section>
  </>;
}

function FeatureCard({ icon: Icon, title, text }) {
  return <article className="feature-card"><div className="feature-icon"><Icon size={21} /></div><h3>{title}</h3><p>{text}</p><span className="card-arrow"><ArrowRight size={16} /></span></article>;
}

function AboutPage() {
  return <PageFrame eyebrow="A safer campus starts with clarity" title={<>Designed for people who <em>look out</em> for one another.</>} intro="CampusSecure brings incident reporting, response coordination, and safety intelligence into one clear, dependable system." pageClass="about-page">
    <div className="about-grid"><div className="about-visual"><div className="about-number">01</div><div><ShieldCheck size={38} /><p>One shared view.<br /><strong>Faster decisions.</strong></p></div></div><div className="about-copy"><p>Campus life is dynamic. A concern can begin with a student, move through a faculty member, and require a coordinated security response. Our purpose is to make that handoff feel immediate and organized.</p><p>CampusSecure supports students, faculty, staff, and security teams with a central, secure place to report what is happening, understand where it is happening, and track what happens next.</p><div className="about-points"><span><CheckCircle2 size={17} /> Faster reporting and response</span><span><CheckCircle2 size={17} /> Centralized incident management</span><span><CheckCircle2 size={17} /> Access shaped by campus roles</span></div></div></div>
  </PageFrame>;
}

function FeaturesPage() {
  return <PageFrame eyebrow="The platform" title={<>A complete picture of <em>campus safety.</em></>} intro="From the first report to the final resolution, every capability is designed to help your campus respond with less friction and more context." pageClass="features-page"><div className="feature-grid feature-grid-all">{features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}</div></PageFrame>;
}

function ContactPage() {
  return <PageFrame eyebrow="Let&apos;s make campus safer" title={<>Connect with your <em>security office.</em></>} intro="Have a question about bringing a more connected response system to your campus? Leave a message and your team can follow up." pageClass="contact-page"><div className="contact-grid"><div className="contact-details"><div className="contact-card"><span className="feature-icon"><Phone size={19} /></span><div><small>Phone</small><strong>[University security phone]</strong></div></div><div className="contact-card"><span className="feature-icon"><Mail size={19} /></span><div><small>Email</small><strong>[Security office email]</strong></div></div><div className="contact-card"><span className="feature-icon"><MapPin size={19} /></span><div><small>Location</small><strong>[Campus security office location]</strong></div></div><div className="emergency-note"><Siren size={21} /><div><strong>For immediate emergencies</strong><p>Use your university&apos;s established emergency number or contact on-site security directly.</p></div></div></div><ContactForm /></div></PageFrame>;
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  return <form className="contact-form" onSubmit={(event) => { event.preventDefault(); setSent(true); }}><div className="form-row"><label>Name<input required placeholder="Your name" /></label><label>Email<input required type="email" placeholder="you@university.edu" /></label></div><label>How can we help?<select defaultValue=""><option value="" disabled>Select a topic</option><option>Platform information</option><option>Campus partnership</option><option>Technical support</option></select></label><label>Message<textarea required rows="5" placeholder="Tell us a little about your campus..." /></label>{sent && <p className="form-success"><CheckCircle2 size={16} /> Message captured. Your security office can follow up through its established channel.</p>}<button className="button button-primary" type="submit">Send message <ArrowRight size={17} /></button></form>;
}

function PageFrame({ eyebrow, title, intro, pageClass, children }) {
  return <main className={`inner-page ${pageClass}`}><div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></div>{children}</main>;
}

export default function PublicSite({ user, onLogout, page = 'home' }) {
  const content = page === 'about' ? <AboutPage /> : page === 'features' ? <FeaturesPage /> : page === 'contact' ? <ContactPage /> : <HomePage />;
  return <div className="public-app"><PublicNav user={user} onLogout={onLogout} />{content}<PublicFooter /></div>;
}

export function AuthPage({ mode, onLogin }) {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      if (!isLogin && form.password !== form.confirmPassword) throw new Error('Passwords do not match.');
      if (!isLogin && form.password.length < 8) throw new Error('Password must be at least 8 characters.');
      const response = await api.post(isLogin ? '/auth/login' : '/auth/register', isLogin ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, role: form.role });
      if (isLogin) {
        const { user, accessToken } = response.data.data;
        localStorage.setItem('token', accessToken); localStorage.setItem('user', JSON.stringify(user)); onLogin(user); navigate('/dashboard', { replace: true });
      } else { setSuccess('Account created. Redirecting you to sign in...'); setTimeout(() => navigate('/login'), 1200); }
    } catch (err) { setError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.'); } finally { setLoading(false); }
  };
  return <div className="auth-page"><div className="auth-aside"><Link to="/" className="brand"><span className="brand-mark"><ShieldCheck size={22} /></span><span>Campus<span>Secure</span></span></Link><div className="auth-aside-copy"><p className="eyebrow">{isLogin ? 'Welcome back' : 'Join the response network'}</p><h1>{isLogin ? <>Keep your campus<br /><em>within reach.</em></> : <>Better safety begins<br /><em>with a signal.</em></>}</h1><p>{isLogin ? 'Sign in to report an incident, follow updates, or support your campus response team.' : 'Create a role-aware account for faster reporting and a more connected campus community.'}</p></div><div className="auth-aside-foot"><LockKeyhole size={16} /> Secure access for authorized campus members</div></div><div className="auth-content"><Link className="back-home" to="/">← Back to CampusSecure</Link><div className="auth-form-wrap"><p className="eyebrow">{isLogin ? 'Secure sign in' : 'Create your account'}</p><h2>{isLogin ? 'Welcome back.' : 'Join CampusSecure.'}</h2><p className="auth-description">{isLogin ? 'Use your campus account to continue.' : 'Public registration is available for students, faculty, and staff.'}</p>{error && <div className="form-error">{error}</div>}{success && <div className="form-success"><CheckCircle2 size={16} /> {success}</div>}<form className="auth-form" onSubmit={submit}>{!isLogin && <label>Full name<input name="name" required value={form.name} onChange={update} placeholder="Your full name" /></label>}<label>Campus email<input name="email" required type="email" value={form.email} onChange={update} placeholder="you@university.edu" /></label><label>Password<input name="password" required type="password" value={form.password} onChange={update} placeholder="At least 8 characters" /></label>{!isLogin && <><label>Confirm password<input name="confirmPassword" required type="password" value={form.confirmPassword} onChange={update} placeholder="Repeat your password" /></label><label>Your role<select name="role" value={form.role} onChange={update}><option value="student">Student</option><option value="faculty">Faculty</option><option value="staff">Staff</option></select></label></>}<button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Please wait...' : isLogin ? 'Sign in to dashboard' : 'Create account'} <ArrowRight size={17} /></button></form><p className="auth-switch">{isLogin ? 'New to CampusSecure?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></p></div></div></div>;
}