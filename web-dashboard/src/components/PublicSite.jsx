import ArrowRight from '@mui/icons-material/ArrowForward';
import CheckCircle2 from '@mui/icons-material/CheckCircleOutline';
import ChevronDown from '@mui/icons-material/KeyboardArrowDown';
import ChevronRight from '@mui/icons-material/ChevronRight';
import X from '@mui/icons-material/Close';
import LayoutDashboard from '@mui/icons-material/Dashboard';
import FileText from '@mui/icons-material/Description';
import Facebook from '@mui/icons-material/Facebook';
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
import { useEffect, useRef, useState } from 'react';
import { CircleMarker, LayersControl, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CAMPUS_LOCATIONS } from '../data/campusLocations';
import api from '../services/api';
import { OAuthButtons } from './AuthScreens';
import { useLanguage } from '../utils/language';
import 'leaflet/dist/leaflet.css';
import './public.css';
import './public-refinements.css';

const CONTACT_CAMPUS = CAMPUS_LOCATIONS.find((location) => location.id === 'mekdela-amba-tulu-awuliya-campus');

function ContactMapSizeHandler() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let animationFrame;
    const invalidateSize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(invalidateSize);
    resizeObserver?.observe(container.parentElement || container);
    const visibilityObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) invalidateSize();
      });
    visibilityObserver?.observe(container);
    invalidateSize();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
    };
  }, [map]);

  return null;
}

const features = [
  {
    id: 'incident-reporting',
    icon: FileText,
    title: 'Real-Time Incident Reporting',
    text: 'Capture what happened, where it happened, and who needs help in seconds.',
    amTitle: 'ክስተትን በቅጽበት ማሳወቅ',
    amText: 'የተፈጠረውን፣ ቦታውን እና እርዳታ የሚፈልገውን በሰከንዶች ውስጥ ያሳውቁ።',
    images: ['incident-reporting-1.jpg', 'incident-reporting-2.jpg', 'incident-reporting-3.jpg']
  },
  {
    id: 'emergency-response',
    icon: Siren,
    title: 'Emergency Response',
    text: 'Route urgent reports to the right response team with clear severity signals.',
    amTitle: 'የአደጋ ጊዜ ምላሽ',
    amText: 'አስቸኳይ ሪፖርቶችን ግልጽ የአደጋ ደረጃ ምልክቶች ይዘው ወደ ተገቢው የምላሽ ቡድን ያድርሱ።',
    images: ['emergency-response-1.jpg', 'emergency-response-2.jpg', 'emergency-response-3.jpg']
  },
  {
    id: 'ai-threat-recognition',
    icon: BrainCircuit,
    title: 'AI-Powered Threat Recognition',
    text: 'Use intelligent signals to help teams identify patterns and prioritize action.',
    amTitle: 'በAI የሚደገፍ የስጋት ለይቶ ማወቅ',
    amText: 'ቡድኖች ሁኔታዎችን እንዲለዩና እርምጃን ቅድሚያ እንዲሰጡ ብልህ ምልክቶችን ይጠቀሙ።',
    images: ['ai-threat-recognition-1.jpg', 'ai-threat-recognition-2.jpg', 'ai-threat-recognition-3.jpg']
  },
  {
    id: 'location-reporting',
    icon: MapPin,
    title: 'Location-Based Reporting',
    text: 'Give responders precise campus context so they can arrive prepared.',
    amTitle: 'በቦታ ላይ የተመሠረተ ሪፖርት',
    amText: 'ምላሽ ሰጪዎች ተዘጋጅተው እንዲደርሱ ትክክለኛ የግቢ ቦታ መረጃ ያቅርቡ።',
    images: ['location-reporting-1.jpg', 'location-reporting-2.jpg', 'location-reporting-3.jpg']
  },
  {
    id: 'alerts-notifications',
    icon: BellRing,
    title: 'Security Alerts & Notifications',
    text: 'Keep campus communities informed with timely, relevant safety updates.',
    amTitle: 'የደህንነት ማንቂያዎች እና ማሳወቂያዎች',
    amText: 'የግቢውን ማኅበረሰብ በወቅቱ በሚደርሱ አስፈላጊ የደህንነት ዝመናዎች ያሳውቁ።',
    images: ['alerts-notifications-1.jpg', 'alerts-notifications-2.jpg', 'alerts-notifications-3.jpg']
  },
  {
    id: 'access-control',
    icon: LockKeyhole,
    title: 'Role-Based Access Control',
    text: 'Give students, staff, security, and administrators the access they need.',
    amTitle: 'በሚና ላይ የተመሠረተ የመዳረሻ ቁጥጥር',
    amText: 'ተማሪዎች፣ ሠራተኞች፣ የደህንነት አባላት እና አስተዳዳሪዎች የሚያስፈልጋቸውን መዳረሻ ያግኙ።',
    images: ['access-control-1.jpg', 'access-control-2.jpg', 'access-control-3.jpg']
  },
  {
    id: 'incident-tracking',
    icon: Radar,
    title: 'Incident Tracking',
    text: 'Follow every report from first signal through investigation and resolution.',
    amTitle: 'የክስተት ክትትል',
    amText: 'እያንዳንዱን ሪፖርት ከመጀመሪያው ምልክት እስከ ምርመራና መፍትሔ ይከታተሉ።',
    images: ['incident-tracking-1.jpg', 'incident-tracking-2.jpg', 'incident-tracking-3.jpg']
  },
  {
    id: 'analytics-monitoring',
    icon: LayoutDashboard,
    title: 'Analytics & Safety Monitoring',
    text: 'Turn incident data into a clearer view of campus safety over time.',
    amTitle: 'ትንታኔ እና የደህንነት ክትትል',
    amText: 'የክስተት መረጃን በጊዜ ሂደት የግቢውን ደህንነት በግልጽ ለማየት ይጠቀሙ።',
    images: ['analytics-monitoring-1.jpg', 'analytics-monitoring-2.jpg', 'analytics-monitoring-3.jpg']
  }
];

const translations = {
  en: {
    mainNavigation: 'Main navigation', campusVisual: 'Campus security operations visual',
    navHome: 'Home', navAbout: 'About', navFeatures: 'Features', navContact: 'Contact',
    aboutOverview: 'Overview', aboutPurpose: 'Our purpose', aboutPrinciples: 'Our commitments',
    language: 'Language', english: 'English', amharic: 'አማርኛ',
    phoneNumber: 'Phone Number', phonePlaceholder: 'Enter your phone number',
    continueWithGoogle: 'Continue with Google', googleConnecting: 'Connecting...', authDivider: 'OR',
    dashboard: 'Dashboard', logout: 'Log out', login: 'Log in', createAccount: 'Create account',
    homeEyebrow: 'Campus safety, connected',
    homeTitle: 'Mekdela Amba University Security and Emergency Response System',
    homeIntro: 'A unified emergency response system that helps students, faculty, staff, and security teams report incidents quickly and act with confidence.',
    reportIncident: 'Report an incident', learnMore: 'Learn more',
    responseReady: 'response ready', sharedSafety: 'shared safety view', roleAccess: 'role-aware access',
    benefitReport: 'Real-Time Incident Reporting', benefitReportText: 'Share what happened with the right campus team.',
    benefitResponse: 'Fast Emergency Response', benefitResponseText: 'Help responders coordinate the next action.',
    benefitLocation: 'Accurate Location Reporting', benefitLocationText: 'Give teams useful campus location context.',
    benefitAlerts: 'Real-Time Security Alerts', benefitAlertsText: 'Keep the community informed as events unfold.',
    howEyebrow: 'A clear path from signal to action', howTitle: 'How It Works',
    stepReport: 'Report', stepReportText: 'Send a clear incident report when something needs attention.',
    stepLocate: 'Locate', stepLocateText: 'Add campus location details so teams know where to go.',
    stepRespond: 'Respond', stepRespondText: 'Coordinate the right response with the relevant team.',
    stepResolve: 'Resolve', stepResolveText: 'Track progress through follow-up and resolution.',
    whyEyebrow: 'Connected campus safety', whyTitle: 'Why CampusSecure',
    whyResponse: 'Faster Response', whyResponseText: 'Bring reports and response teams into one coordinated flow.',
    whyLocation: 'Accurate Location', whyLocationText: 'Make it easier to understand where support is needed.',
    whyAlerts: 'Real-Time Alerts', whyAlertsText: 'Share timely updates through the established campus system.',
    whyMonitoring: 'Centralized Monitoring', whyMonitoringText: 'Keep incident activity and follow-up in one shared view.',
    mapEyebrow: 'Campus-wide awareness', mapTitle: 'Know What’s Happening Across Campus',
    mapText: 'Explore a campus-wide view designed to help teams understand locations and coordinate a timely response.',
    mapButton: 'View Security Map', mapVisualAlt: 'Aerial view of a university campus',
    sosEyebrow: 'Support when it matters', sosTitle: 'Need Immediate Help?',
    sosText: 'Connect with your campus response channels. For immediate emergencies, use your university’s established emergency number or contact on-site security.',
    sosButton: 'Emergency / SOS', sosReportButton: 'Report an Incident',
    mobileEyebrow: 'Campus safety in your pocket', mobileTitle: 'Safety at Your Fingertips',
    mobileText: 'A mobile-friendly way to reach reporting, emergency support, alerts, location tools, and safety resources.',
    mobileReport: 'Report Incident', mobileSos: 'SOS', mobileAlerts: 'Alerts',
    mobileLocation: 'Location', mobileResources: 'Safety Resources',
    audienceEyebrow: 'Made for the whole campus', audienceTitle: 'Who Is It For?',
    audienceStudents: 'Students', audienceStudentsText: 'A clear way to raise a concern and find campus safety information.',
    audienceSecurity: 'Security Officers', audienceSecurityText: 'Useful context to coordinate reports and response.',
    audienceAdmins: 'Administrators', audienceAdminsText: 'A shared view to support campus safety operations.',
    audienceCommunity: 'University Community', audienceCommunityText: 'A connected approach to looking out for one another.',
    intelligenceEyebrow: 'A clearer operational picture', intelligenceTitle: 'Turn Safety Data Into Better Decisions',
    intelligenceText: 'Bring incident trends, response monitoring, safety analytics, and campus risk awareness into a more useful shared view.',
    intelligenceTrends: 'Incident Trends', intelligenceResponse: 'Response Monitoring',
    intelligenceAnalytics: 'Safety Analytics', intelligenceRisk: 'Campus Risk Awareness',
    finalEyebrow: 'Together, we can do more', finalTitle: 'Help Make Campus Safer',
    finalReport: 'Report an Incident', finalLearn: 'Learn More',
    oneSystem: 'One system for', students: 'Students', faculty: 'Faculty', staff: 'Staff',
    securityTeams: 'Security teams', campusLeaders: 'Campus leaders',
    builtAroundResponse: 'Built around response', homeFeaturesTitle: 'Safety tools that move',
    homeFeaturesAccent: 'at campus speed.', exploreFeatures: 'Explore all features',
    emergencyEyebrow: 'When every second counts', emergencyTitle: 'Make the next right action easier.',
    getInTouch: 'Get in touch',
    heroPanelNotified: 'Response team notified', heroPanelLocation: 'North quad · 2 min ago',
    heroPanelCampus: 'Campus watch', heroPanelStatus: 'All systems operational', heroCaption: 'Watchful by design',
    aboutEyebrow: 'A safer campus starts with clarity',
    aboutTitleStart: 'Designed for people who', aboutTitleAccent: 'look out',
    aboutTitleEnd: 'for one another.',
    aboutIntro: 'CampusSecure brings incident reporting, response coordination, and safety intelligence into one clear, dependable system.',
    aboutParagraphOne: 'Campus life is dynamic. A concern can begin with a student, move through a faculty member, and require a coordinated security response. Our purpose is to make that handoff feel immediate and organized.',
    aboutParagraphTwo: 'CampusSecure supports students, faculty, staff, and security teams with a central, secure place to report what is happening, understand where it is happening, and track what happens next.',
    aboutVisual: 'One shared view.', aboutVisualAccent: 'Faster decisions.',
    aboutPointOne: 'Faster reporting and response', aboutPointTwo: 'Centralized incident management',
    aboutPointThree: 'Access shaped by campus roles',
    featuresEyebrow: 'The platform', featuresTitle: 'A complete picture of',
    featuresTitleAccent: 'campus safety.',
    featuresIntro: 'From the first report to the final resolution, every capability is designed to help your campus respond with less friction and more context.',
    contactEyebrow: 'Let’s make campus safer', contactTitle: 'Connect with your',
    contactTitleAccent: 'security office.',
    contactIntro: 'Have a question about bringing a more connected response system to your campus? Leave a message and your team can follow up.',
    phone: 'Phone', email: 'Email', location: 'Location',
    immediateEmergency: 'For immediate emergencies',
    emergencyInstructions: 'Use your university’s established emergency number or contact on-site security directly.',
    name: 'Name', yourName: 'Your name', emailPlaceholder: 'you@university.edu',
    howHelp: 'How can we help?', selectTopic: 'Select a topic', platformInformation: 'Platform information',
    campusPartnership: 'Campus partnership', technicalSupport: 'Technical support',
    message: 'Message', messagePlaceholder: 'Tell us a little about your campus...',
    messageCaptured: 'Message captured. Your security office can follow up through its established channel.',
    sendMessage: 'Send message',
    footerIntro: 'A calmer, faster way to coordinate safety across the places where campus life happens.',
    explore: 'Explore', aboutUs: 'About us', forCampusTeams: 'For campus teams',
    signIn: 'Sign in', joinPlatform: 'Join the platform', incidentResponse: 'Incident response',
    needUrgentHelp: 'Need urgent help?',
    footerEmergency: 'For immediate emergencies, use your university’s established emergency channel.',
    contactGuidance: 'View contact guidance', footerTagline: 'Built for safer campus communities.',
    developerCredit: 'Developed by Fentaw Shitaw'
  },
  am: {
    mainNavigation: 'ዋና አሰሳ', campusVisual: 'የግቢ ደህንነት ኦፕሬሽን ምስል',
    navHome: 'መነሻ', navAbout: 'ስለ እኛ', navFeatures: 'ባህሪያት', navContact: 'ያግኙን',
    aboutOverview: 'አጠቃላይ እይታ', aboutPurpose: 'ዓላማችን', aboutPrinciples: 'ቁርጠኝነታችን',
    language: 'ቋንቋ', english: 'English', amharic: 'አማርኛ',
    phoneNumber: 'ስልክ ቁጥር', phonePlaceholder: 'ስልክ ቁጥርዎን ያስገቡ',
    continueWithGoogle: 'በGoogle ይቀጥሉ', googleConnecting: 'በመገናኘት ላይ...', authDivider: 'ወይም',
    dashboard: 'ዳሽቦርድ', logout: 'ውጣ', login: 'ግባ', createAccount: 'መለያ ይፍጠሩ',
    homeEyebrow: 'የግቢ ደህንነት፣ በአንድነት',
    homeTitle: 'የመቅደላ አምባ ዩኒቨርሲቲ የደህንነትና የአደጋ ጊዜ ምላሽ ሥርዓት',
    homeIntro: 'ተማሪዎች፣ መምህራን፣ ሠራተኞች እና የደህንነት ቡድኖች ክስተቶችን በፍጥነት እንዲያሳውቁና በበለጠ እምነት እንዲሠሩ የሚያግዝ የተቀናጀ የአደጋ ጊዜ ምላሽ ሥርዓት።',
    reportIncident: 'ክስተት ያሳውቁ', learnMore: 'ተጨማሪ ይወቁ',
    responseReady: 'ለምላሽ ዝግጁ', sharedSafety: 'የጋራ የደህንነት እይታ',
    roleAccess: 'በሚና የተመሠረተ መዳረሻ',
    benefitReport: 'ክስተትን በቅጽበት ማሳወቅ', benefitReportText: 'የተፈጠረውን ለተገቢው የግቢ ቡድን ያጋሩ።',
    benefitResponse: 'ፈጣን የአደጋ ጊዜ ምላሽ', benefitResponseText: 'ምላሽ ሰጪዎች ቀጣዩን እርምጃ እንዲያቀናጁ ያግዙ።',
    benefitLocation: 'ትክክለኛ የቦታ ሪፖርት', benefitLocationText: 'ለቡድኖች ጠቃሚ የግቢ ቦታ መረጃ ይስጡ።',
    benefitAlerts: 'በቅጽበት የደህንነት ማንቂያዎች', benefitAlertsText: 'ሁኔታዎች ሲከሰቱ ማኅበረሰቡን ያሳውቁ።',
    howEyebrow: 'ከሪፖርት እስከ እርምጃ ግልጽ መንገድ', howTitle: 'እንዴት ይሠራል',
    stepReport: 'ሪፖርት ያድርጉ', stepReportText: 'ትኩረት የሚፈልግ ነገር ሲኖር ግልጽ ሪፖርት ይላኩ።',
    stepLocate: 'ቦታ ይግለጹ', stepLocateText: 'ቡድኖች ወዴት እንደሚሄዱ እንዲያውቁ የግቢውን ቦታ ያክሉ።',
    stepRespond: 'ምላሽ ይስጡ', stepRespondText: 'ከተገቢው ቡድን ጋር ምላሹን ያቀናጁ።',
    stepResolve: 'ይፍቱ', stepResolveText: 'እስከ ክትትልና መፍትሔ ድረስ እድገቱን ይከታተሉ።',
    whyEyebrow: 'የተቀናጀ የግቢ ደህንነት', whyTitle: 'ለምን CampusSecure',
    whyResponse: 'ፈጣን ምላሽ', whyResponseText: 'ሪፖርቶችንና ምላሽ ሰጪ ቡድኖችን በአንድ የተቀናጀ ሂደት ያገናኙ።',
    whyLocation: 'ትክክለኛ ቦታ', whyLocationText: 'ድጋፍ የሚያስፈልገው ቦታ በቀላሉ እንዲታወቅ ያድርጉ።',
    whyAlerts: 'በቅጽበት ማንቂያዎች', whyAlertsText: 'በተለመደው የግቢ ሥርዓት ወቅታዊ ዝመናዎችን ያጋሩ።',
    whyMonitoring: 'የተማከለ ክትትል', whyMonitoringText: 'የክስተት እንቅስቃሴንና ክትትልን በአንድ የጋራ እይታ ይያዙ።',
    mapEyebrow: 'በመላው ግቢ ግንዛቤ', mapTitle: 'በግቢው ውስጥ ምን እየተፈጠረ እንዳለ ይወቁ',
    mapText: 'ቡድኖች ቦታዎችን እንዲረዱና ወቅታዊ ምላሽ እንዲያቀናጁ የተዘጋጀውን የግቢ እይታ ይመልከቱ።',
    mapButton: 'የደህንነት ካርታን ይመልከቱ', mapVisualAlt: 'የዩኒቨርሲቲ ግቢ ከላይ የተነሳ ምስል',
    sosEyebrow: 'በሚያስፈልግበት ጊዜ ድጋፍ', sosTitle: 'አስቸኳይ እርዳታ ይፈልጋሉ?',
    sosText: 'ከግቢዎ የምላሽ መንገዶች ጋር ይገናኙ። ለአስቸኳይ አደጋ የዩኒቨርሲቲዎን የአደጋ ጊዜ ቁጥር ይጠቀሙ ወይም በቦታው ያለውን ደህንነት ያነጋግሩ።',
    sosButton: 'አደጋ / SOS', sosReportButton: 'ክስተት ያሳውቁ',
    mobileEyebrow: 'የግቢ ደህንነት በእጅዎ', mobileTitle: 'ደህንነት በእጅዎ',
    mobileText: 'ሪፖርት፣ የአደጋ ጊዜ ድጋፍ፣ ማንቂያዎች፣ የቦታ መሣሪያዎችና የደህንነት ምንጮችን በቀላሉ ለመድረስ።',
    mobileReport: 'ክስተት ያሳውቁ', mobileSos: 'SOS', mobileAlerts: 'ማንቂያዎች',
    mobileLocation: 'ቦታ', mobileResources: 'የደህንነት ምንጮች',
    audienceEyebrow: 'ለመላው ግቢ የተዘጋጀ', audienceTitle: 'ለማን ነው?',
    audienceStudents: 'ተማሪዎች', audienceStudentsText: 'ጉዳይን ለማሳወቅና የግቢ ደህንነት መረጃን ለማግኘት ግልጽ መንገድ።',
    audienceSecurity: 'የደህንነት ኦፊሰሮች', audienceSecurityText: 'ሪፖርቶችንና ምላሽን ለማቀናጀት ጠቃሚ መረጃ።',
    audienceAdmins: 'አስተዳዳሪዎች', audienceAdminsText: 'የግቢ ደህንነት ሥራዎችን ለመደገፍ የጋራ እይታ።',
    audienceCommunity: 'የዩኒቨርሲቲ ማኅበረሰብ', audienceCommunityText: 'እርስ በርስ ለመጠነቃቀቅ የተቀናጀ አቀራረብ።',
    intelligenceEyebrow: 'ግልጽ የሥራ እይታ', intelligenceTitle: 'የደህንነት መረጃን ወደ የተሻለ ውሳኔ ይቀይሩ',
    intelligenceText: 'የክስተት አዝማሚያዎችን፣ የምላሽ ክትትልን፣ የደህንነት ትንታኔንና የግቢ ስጋት ግንዛቤን በጠቃሚ የጋራ እይታ ያገናኙ።',
    intelligenceTrends: 'የክስተት አዝማሚያዎች', intelligenceResponse: 'የምላሽ ክትትል',
    intelligenceAnalytics: 'የደህንነት ትንታኔ', intelligenceRisk: 'የግቢ ስጋት ግንዛቤ',
    finalEyebrow: 'በአንድነት የበለጠ እንችላለን', finalTitle: 'ግቢውን የበለጠ ደህንነቱ የተጠበቀ እናድርግ',
    finalReport: 'ክስተት ያሳውቁ', finalLearn: 'ተጨማሪ ይወቁ',
    oneSystem: 'ለሁሉም አንድ ሥርዓት', students: 'ተማሪዎች', faculty: 'መምህራን',
    staff: 'ሠራተኞች', securityTeams: 'የደህንነት ቡድኖች', campusLeaders: 'የግቢ አመራሮች',
    builtAroundResponse: 'በምላሽ ላይ የተመሠረተ', homeFeaturesTitle: 'የደህንነት መሣሪያዎች',
    homeFeaturesAccent: 'ለግቢው ፍጥነት የተዘጋጁ።', exploreFeatures: 'ሁሉንም ባህሪያት ይመልከቱ',
    emergencyEyebrow: 'እያንዳንዱ ሰከንድ ወሳኝ ሲሆን',
    emergencyTitle: 'ትክክለኛውን እርምጃ መውሰድ ቀላል ያድርጉ።',
    getInTouch: 'ያግኙን',
    heroPanelNotified: 'የምላሽ ቡድኑ ተነግሮታል', heroPanelLocation: 'ሰሜን አደባባይ · ከ2 ደቂቃ በፊት',
    heroPanelCampus: 'የግቢ ክትትል', heroPanelStatus: 'ሁሉም ሥርዓቶች በሥራ ላይ ናቸው',
    heroCaption: 'በንቃት የተነደፈ',
    aboutEyebrow: 'ደህንነቱ የተጠበቀ ግቢ በግልጽነት ይጀምራል',
    aboutTitleStart: 'እርስ በርሳቸው ለሚጠነቀቁ', aboutTitleAccent: 'ሰዎች',
    aboutTitleEnd: 'የተዘጋጀ።',
    aboutIntro: 'CampusSecure የክስተት ሪፖርትን፣ የምላሽ ቅንጅትን እና የደህንነት መረጃን በአንድ ግልጽና አስተማማኝ ሥርዓት ያገናኛል።',
    aboutParagraphOne: 'የግቢ ሕይወት ተለዋዋጭ ነው። ጉዳይ በተማሪ ሊጀምር፣ በመምህር ሊተላለፍ እና የተቀናጀ የደህንነት ምላሽ ሊያስፈልገው ይችላል። ዓላማችን ይህን ርክክብ ፈጣንና የተደራጀ ማድረግ ነው።',
    aboutParagraphTwo: 'CampusSecure ተማሪዎችን፣ መምህራንን፣ ሠራተኞችን እና የደህንነት ቡድኖችን ሁኔታውን ለማሳወቅ፣ ቦታውን ለመረዳት እና ቀጣይ እርምጃን ለመከታተል በአንድ ደህንነቱ በተጠበቀ ማዕከል ያግዛል።',
    aboutVisual: 'የጋራ እይታ።', aboutVisualAccent: 'ፈጣን ውሳኔዎች።',
    aboutPointOne: 'ፈጣን ሪፖርትና ምላሽ', aboutPointTwo: 'የተማከለ የክስተት አስተዳደር',
    aboutPointThree: 'እንደ ግቢው ሚና የተዘጋጀ መዳረሻ',
    featuresEyebrow: 'መድረኩ', featuresTitle: 'የግቢ ደህንነት',
    featuresTitleAccent: 'ሙሉ እይታ።',
    featuresIntro: 'ከመጀመሪያው ሪፖርት እስከ መጨረሻው መፍትሔ፣ እያንዳንዱ ባህሪ ግቢዎ በትንሽ መሰናክልና በበለጠ መረጃ ምላሽ እንዲሰጥ ተዘጋጅቷል።',
    contactEyebrow: 'ግቢውን የበለጠ ደህንነቱ የተጠበቀ እናድርግ',
    contactTitle: 'ከደህንነት', contactTitleAccent: 'ጽሕፈት ቤት ጋር ይገናኙ።',
    contactIntro: 'ስለ ተቀናጀ የምላሽ ሥርዓት ጥያቄ አለዎት? መልዕክት ይተዉ፤ ቡድኑ ይከታተላል።',
    phone: 'ስልክ', email: 'ኢሜይል', location: 'ቦታ',
    securityPhone: '0976296127', securityEmail: 'yaekobshitaw@gmail.com',
    securityLocation: 'Tuluawulia',
    immediateEmergency: 'ለአስቸኳይ አደጋዎች',
    emergencyInstructions: 'የዩኒቨርሲቲዎን የአደጋ ጊዜ ቁጥር ይጠቀሙ ወይም በቦታው ያለውን የደህንነት አካል በቀጥታ ያነጋግሩ።',
    name: 'ስም', yourName: 'ሙሉ ስምዎ', emailPlaceholder: 'you@university.edu',
    howHelp: 'እንዴት ልንርዳዎ?', selectTopic: 'ርዕስ ይምረጡ',
    platformInformation: 'ስለ መድረኩ መረጃ', campusPartnership: 'የግቢ ትብብር',
    technicalSupport: 'የቴክኒክ ድጋፍ', message: 'መልዕክት',
    messagePlaceholder: 'ስለ ግቢዎ ትንሽ ይንገሩን...',
    messageCaptured: 'መልዕክትዎ ተቀብሏል። የደህንነት ጽሕፈት ቤቱ በተለመደው መንገድ ይከታተላል።',
    sendMessage: 'መልዕክት ይላኩ',
    footerIntro: 'የግቢ ሕይወት በሚካሄድባቸው ቦታዎች ደህንነትን በተሻለ ሁኔታ ለማቀናጀት የተዘጋጀ።',
    explore: 'ይመልከቱ', aboutUs: 'ስለ እኛ', forCampusTeams: 'ለግቢ ቡድኖች',
    signIn: 'ይግቡ', joinPlatform: 'መድረኩን ይቀላቀሉ', incidentResponse: 'ለክስተት ምላሽ',
    needUrgentHelp: 'አስቸኳይ እርዳታ ይፈልጋሉ?',
    footerEmergency: 'ለአስቸኳይ አደጋዎች የዩኒቨርሲቲዎን የአደጋ ጊዜ መንገድ ይጠቀሙ።',
    contactGuidance: 'የእውቂያ መመሪያ', footerTagline: 'ለበለጠ ደህንነቱ ለተጠበቀ የግቢ ማኅበረሰብ የተዘጋጀ።',
    developerCredit: 'Developed by Fentaw Shitaw'
  }
};

const featureTitle = (feature, language) => language === 'am' ? feature.amTitle : feature.title;
const featureText = (feature, language) => language === 'am' ? feature.amText : feature.text;
const featureImagesPath = (filename) => `/images/features/${filename}`;

// Real campus photos used in the rotating hero carousel.
// Place the matching image files in your project's public/images/ folder
// with these exact filenames (or update the paths below to wherever you
// host them).
const heroSlides = [
  '/images/campus-1.jpg', // main entrance arch
  '/images/campus-2.jpg', // campus road with dorm block
  '/images/campus-3.jpg', // admin building approach
  '/images/campus-4.jpg', // aerial road + residence halls
  '/images/campus-5.jpg'  // STEM/admin block + lawn
];

function PublicNav({ user, onLogout, language, onLanguageChange, copy }) {
  const [open, setOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const closeMenu = () => {
    setOpen(false);
    setActiveDropdown(null);
  };

  const dropdownProps = (name) => ({
    onMouseEnter: () => {
      if (window.matchMedia?.('(hover: hover) and (min-width: 921px)').matches) setActiveDropdown(name);
    },
    onMouseLeave: () => {
      if (window.matchMedia?.('(hover: hover) and (min-width: 921px)').matches) setActiveDropdown(null);
    },
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setActiveDropdown(null);
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        event.currentTarget.querySelector('.nav-dropdown-trigger')?.focus();
        setActiveDropdown(null);
      }
    }
  });

  return (
    <header className="public-nav-wrap">
      <nav className="public-nav" aria-label={copy.mainNavigation}>
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark"><img src="/images/logo.png" alt="Mekdela Amba University logo" /></span>
          <span>Campus<span>Secure</span></span>
        </Link>
        <button className="mobile-menu" onClick={() => { setOpen(!open); setActiveDropdown(null); }} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`nav-links ${open ? 'is-open' : ''}`}>
          <Link to="/" onClick={closeMenu}>{copy.navHome}</Link>
          <div className={`nav-dropdown ${activeDropdown === 'about' ? 'is-open' : ''}`} {...dropdownProps('about')}>
            <button
              className="nav-dropdown-trigger"
              type="button"
              aria-haspopup="true"
              aria-expanded={activeDropdown === 'about'}
              onFocus={(event) => {
                if (event.target.matches(':focus-visible')) setActiveDropdown('about');
              }}
              onClick={() => {
                if (window.matchMedia?.('(hover: hover) and (min-width: 921px)').matches) setActiveDropdown('about');
                else setActiveDropdown(activeDropdown === 'about' ? null : 'about');
              }}
            >
              {copy.navAbout}<ChevronDown size={16} />
            </button>
            <div className="nav-dropdown-menu" role="menu" aria-label={copy.navAbout} aria-hidden={activeDropdown !== 'about'}>
              <Link role="menuitem" to="/about#about-overview" onClick={closeMenu}>{copy.aboutOverview}</Link>
              <Link role="menuitem" to="/about#about-purpose" onClick={closeMenu}>{copy.aboutPurpose}</Link>
              <Link role="menuitem" to="/about#about-principles" onClick={closeMenu}>{copy.aboutPrinciples}</Link>
            </div>
          </div>
          <div className={`nav-dropdown nav-features-dropdown ${activeDropdown === 'features' ? 'is-open' : ''}`} {...dropdownProps('features')}>
            <button
              className="nav-dropdown-trigger"
              type="button"
              aria-haspopup="true"
              aria-expanded={activeDropdown === 'features'}
              onFocus={(event) => {
                if (event.target.matches(':focus-visible')) setActiveDropdown('features');
              }}
              onClick={() => {
                if (window.matchMedia?.('(hover: hover) and (min-width: 921px)').matches) setActiveDropdown('features');
                else setActiveDropdown(activeDropdown === 'features' ? null : 'features');
              }}
            >
              {copy.navFeatures}<ChevronDown size={16} />
            </button>
            <div className="nav-dropdown-menu" role="menu" aria-label={copy.navFeatures} aria-hidden={activeDropdown !== 'features'}>
              {features.map((feature) => (
                <Link key={feature.id} role="menuitem" to={`/features#${feature.id}`} onClick={closeMenu}>
                  {featureTitle(feature, language)}
                </Link>
              ))}
            </div>
          </div>
          <Link to="/contact" onClick={closeMenu}>{copy.navContact}</Link>
          <label className="language-switcher">
            <span className="sr-only">{copy.language}</span>
            <select aria-label={copy.language} value={language} onChange={(event) => onLanguageChange(event.target.value)}>
              <option value="en">{copy.english}</option>
              <option value="am">{copy.amharic}</option>
            </select>
          </label>
          {user ? (
            <>
              <Link className="nav-dashboard" to="/dashboard" onClick={closeMenu}><LayoutDashboard size={16} /> {copy.dashboard}</Link>
              <button className="nav-logout" onClick={() => { closeMenu(); onLogout(); }}>{copy.logout}</button>
            </>
          ) : (
            <>
              <Link className="nav-login" to="/login" onClick={closeMenu}>{copy.login}</Link>
              <Link className="nav-register" to="/register" onClick={closeMenu}>{copy.createAccount} <ArrowRight size={15} /></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter({ copy, dashboard = false }) {
  const [language] = useLanguage();
  const footerCopy = copy || translations[language];
  if (dashboard) {
    return (
      <footer className="public-footer dashboard-footer-compact">
        <span className="dashboard-footer-copyright">© {new Date().getFullYear()} Mekdela Amba University Security System</span>
        <span className="dashboard-footer-separator" aria-hidden="true">•</span>
        <span className="dashboard-footer-version">v1.0.0</span>
      </footer>
    );
  }

  return (
    <footer className="public-footer">
      <div className="footer-grid">
        <div>
          <Link to="/" className="brand footer-brand"><span className="brand-mark"><img src="/images/logo.png" alt="Mekdela Amba University logo" /></span><span>Campus<span>Secure</span></span></Link>
          <p className="footer-intro">{footerCopy.footerIntro}</p>
        </div>
        <div><h3>{footerCopy.explore}</h3><Link to="/about">{footerCopy.aboutUs}</Link><Link to="/features">{footerCopy.navFeatures}</Link><Link to="/contact">{footerCopy.navContact}</Link></div>
        <div><h3>{footerCopy.forCampusTeams}</h3><Link to="/login">{footerCopy.signIn}</Link><Link to="/register">{footerCopy.joinPlatform}</Link><span>{footerCopy.incidentResponse}</span></div>
        <div className="footer-emergency"><h3>{footerCopy.needUrgentHelp}</h3><p>{footerCopy.footerEmergency}</p><Link to="/contact">{footerCopy.contactGuidance} <ChevronRight size={15} /></Link></div>
        <a
          className="footer-social-link footer-social-center"
          href="https://www.facebook.com/share/p/19eZdwWDvh/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          title="MAU Campus Security on Facebook"
        >
          <Facebook className="footer-social-icon" aria-hidden="true" />
          <span>Facebook</span>
        </a>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} CampusSecure</span><span>{footerCopy.footerTagline}</span><span>{footerCopy.developerCredit}</span></div>
    </footer>
  );
}

function CampusCarousel({ copy }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener?.('change', updateMotionPreference);
    return () => motionPreference.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || isHovered || isFocused) return undefined;
    const timeoutId = window.setTimeout(() => {
      setSlideDirection('next');
      setSlideIndex((currentIndex) => (currentIndex + 1) % heroSlides.length);
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [isFocused, isHovered, reducedMotion, slideIndex]);

  const changeSlide = (direction) => {
    setSlideDirection(direction);
    setSlideIndex((currentIndex) =>
      (currentIndex + (direction === 'next' ? 1 : heroSlides.length - 1)) % heroSlides.length
    );
  };

  return (
    <div
      className="hero-visual"
      role="region"
      aria-label={copy.campusVisual}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {heroSlides.map((slide, index) => {
        const isActive = index === slideIndex;
        return (
          <div
            className={`visual-slide${isActive ? ` slide-${slideDirection} is-active` : ''}`}
            key={slide}
            aria-hidden={!isActive}
          >
            <img src={slide} alt={`${copy.campusVisual} ${index + 1}`} />
          </div>
        );
      })}
      <div className="visual-overlay" />
      <button className="visual-arrow visual-arrow-previous" type="button" aria-label="Previous image" onClick={() => changeSlide('previous')}>&lt;</button>
      <button className="visual-arrow visual-arrow-next" type="button" aria-label="Next image" onClick={() => changeSlide('next')}>&gt;</button>
      <div className="visual-panel panel-alert"><span className="panel-icon"><Siren size={17} /></span><span><strong>{copy.heroPanelNotified}</strong><small>{copy.heroPanelLocation}</small></span><CheckCircle2 size={18} /></div>
      <div className="visual-panel panel-status"><span className="radar-icon"><Radar size={22} /></span><span><strong>{copy.heroPanelCampus}</strong><small>{copy.heroPanelStatus}</small></span><span className="live-label">LIVE</span></div>
      <div className="visual-caption"><span>{String(slideIndex + 1).padStart(2, '0')}</span><span>{copy.heroCaption}</span></div>
    </div>
  );
}

function HomePage({ language, copy }) {
  const homeRef = useRef(null);

  useEffect(() => {
    const home = homeRef.current;
    if (!home || !('IntersectionObserver' in window)) return undefined;

    const publicApp = home.closest('.public-app');
    const footer = document.querySelector('.public-footer');
    const heroTitleBlock = home.querySelector('.hero-title-block');
    const revealTargets = [
      ...home.querySelectorAll('.motion-reveal, .feature-card'),
      ...(footer ? [footer] : [])
    ];
    revealTargets.forEach((target) => target.classList.add('motion-reveal'));
    publicApp?.classList.add('is-home-motion-ready');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === heroTitleBlock) {
          entry.target.classList.toggle('is-title-visible', entry.isIntersecting);
          return;
        }
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    revealTargets.forEach((target) => observer.observe(target));
    if (heroTitleBlock) observer.observe(heroTitleBlock);

    return () => {
      observer.disconnect();
      publicApp?.classList.remove('is-home-motion-ready');
      revealTargets.forEach((target) => target.classList.remove('motion-reveal', 'is-visible'));
      heroTitleBlock?.classList.remove('is-title-visible');
    };
  }, []);

  return <div className="home-page" ref={homeRef}>
    <section className="hero-section">
      <div className="hero-title-block">
        <p className="eyebrow"><span className="status-dot" /> {copy.homeEyebrow}</p>
        <h1 className="hero-title">{copy.homeTitle}</h1>
      </div>
      <div className="hero-copy">
        <p className="hero-subtitle">{copy.homeIntro}</p>
        <div className="hero-actions"><Link className="button button-primary" to="/login">{copy.reportIncident} <ArrowRight size={18} /></Link><Link className="button button-quiet" to="/about">{copy.learnMore} <ChevronRight size={17} /></Link></div>
        <div className="hero-proof"><div><strong>24/7</strong><span>{copy.responseReady}</span></div><div><strong>01</strong><span>{copy.sharedSafety}</span></div><div><strong>100%</strong><span>{copy.roleAccess}</span></div></div>
      </div>
      <CampusCarousel copy={copy} />
    </section>
    <section className="trust-strip" aria-label={copy.oneSystem}>
      <strong>{copy.oneSystem}</strong>
      <span>{copy.students}</span>
      <span>{copy.faculty}</span>
      <span>{copy.staff}</span>
      <span>{copy.securityTeams}</span>
      <span>{copy.campusLeaders}</span>
    </section>
    <section className="home-benefits motion-reveal" aria-label={copy.homeEyebrow}>
      <div className="home-benefit"><span className="home-benefit-icon"><FileText size={20} /></span><div><h3 role="presentation">{copy.benefitReport}</h3><p>{copy.benefitReportText}</p></div></div>
      <div className="home-benefit"><span className="home-benefit-icon"><Siren size={20} /></span><div><h3>{copy.benefitResponse}</h3><p>{copy.benefitResponseText}</p></div></div>
      <div className="home-benefit"><span className="home-benefit-icon"><MapPin size={20} /></span><div><h3>{copy.benefitLocation}</h3><p>{copy.benefitLocationText}</p></div></div>
      <div className="home-benefit"><span className="home-benefit-icon"><BellRing size={20} /></span><div><h3>{copy.benefitAlerts}</h3><p>{copy.benefitAlertsText}</p></div></div>
    </section>
    <section className="section feature-preview motion-reveal"><div className="section-heading"><div><p className="eyebrow">{copy.builtAroundResponse}</p><h2>{copy.homeFeaturesTitle}<br /><em>{copy.homeFeaturesAccent}</em></h2></div><Link className="text-link" to="/features">{copy.exploreFeatures} <ArrowRight size={16} /></Link></div><div className="feature-grid">{features.map((feature, index) => <FeatureCard key={feature.id} feature={feature} index={index} language={language} revealIndex={index} />)}</div></section>
    <section className="section home-process motion-reveal">
      <div className="section-heading"><div><p className="eyebrow">{copy.howEyebrow}</p><h2>{copy.howTitle}</h2></div></div>
      <div className="home-process-grid">
        <article className="process-step">
          <div className="process-image-frame"><img src="/images/features/incident-reporting-1.jpg" alt="" loading="lazy" /></div>
          <div className="process-step-content"><span className="process-number">01</span><span className="process-icon"><FileText size={23} /></span><h3>{copy.stepReport}</h3><p>{copy.stepReportText}</p></div>
        </article>
        <article className="process-step">
          <div className="process-image-frame"><img src="/images/features/location-reporting-1.jpg" alt="" loading="lazy" /></div>
          <div className="process-step-content"><span className="process-number">02</span><span className="process-icon"><MapPin size={23} /></span><h3>{copy.stepLocate}</h3><p>{copy.stepLocateText}</p></div>
        </article>
        <article className="process-step">
          <div className="process-image-frame"><img src="/images/features/emergency-response-1.jpg" alt="" loading="lazy" /></div>
          <div className="process-step-content"><span className="process-number">03</span><span className="process-icon"><Siren size={23} /></span><h3>{copy.stepRespond}</h3><p>{copy.stepRespondText}</p></div>
        </article>
        <article className="process-step">
          <div className="process-image-frame"><img src="/images/features/incident-tracking-1.jpg" alt="" loading="lazy" /></div>
          <div className="process-step-content"><span className="process-number">04</span><span className="process-icon"><CheckCircle2 size={23} /></span><h3>{copy.stepResolve}</h3><p>{copy.stepResolveText}</p></div>
        </article>
      </div>
    </section>
    <section className="section home-why motion-reveal">
      <div className="section-heading"><div><p className="eyebrow">{copy.whyEyebrow}</p><h2>{copy.whyTitle}</h2></div></div>
      <div className="home-why-grid">
        <article className="why-card">
          <div className="why-image-frame"><img src="/images/features/emergency-response-2.jpg" alt="" loading="lazy" /></div>
          <div className="why-card-content"><span className="why-icon"><Siren size={23} /></span><h3>{copy.whyResponse}</h3><p>{copy.whyResponseText}</p></div>
        </article>
        <article className="why-card">
          <div className="why-image-frame"><img src="/images/features/location-reporting-2.jpg" alt="" loading="lazy" /></div>
          <div className="why-card-content"><span className="why-icon"><MapPin size={23} /></span><h3>{copy.whyLocation}</h3><p>{copy.whyLocationText}</p></div>
        </article>
        <article className="why-card">
          <div className="why-image-frame"><img src="/images/features/alerts-notifications-1.jpg" alt="" loading="lazy" /></div>
          <div className="why-card-content"><span className="why-icon"><BellRing size={23} /></span><h3>{copy.whyAlerts}</h3><p>{copy.whyAlertsText}</p></div>
        </article>
        <article className="why-card">
          <div className="why-image-frame"><img src="/images/features/analytics-monitoring-1.jpg" alt="" loading="lazy" /></div>
          <div className="why-card-content"><span className="why-icon"><LayoutDashboard size={23} /></span><h3>{copy.whyMonitoring}</h3><p>{copy.whyMonitoringText}</p></div>
        </article>
      </div>
    </section>
    <section className="section home-map-section motion-reveal">
      <div className="home-map-grid">
        <div className="home-map-visual">
          <img src="/images/campus-4.jpg" alt={copy.mapVisualAlt} loading="lazy" />
          <div className="map-visual-shade" />
          <svg className="map-route" viewBox="0 0 600 420" aria-hidden="true"><path d="M76 330 C140 300 145 242 230 250 S330 190 378 214 445 170 516 94" /></svg>
          <span className="map-marker map-marker-one"><MapPin size={19} /></span>
          <span className="map-marker map-marker-two"><ShieldCheck size={19} /></span>
          <span className="map-label">{copy.whyMonitoring}</span>
        </div>
        <div className="home-map-copy"><p className="eyebrow">{copy.mapEyebrow}</p><h2>{copy.mapTitle}</h2><p>{copy.mapText}</p><Link className="button button-primary" to="/map">{copy.mapButton} <ArrowRight size={17} /></Link></div>
      </div>
    </section>
    <section className="section home-emergency-section motion-reveal">
      <div className="home-emergency-grid">
        <div className="response-visual" aria-hidden="true">
          <span className="response-orbit response-orbit-one" /><span className="response-orbit response-orbit-two" />
          <span className="response-shield"><ShieldCheck size={76} /></span>
          <span className="response-signal response-signal-one"><BellRing size={19} /></span>
          <span className="response-signal response-signal-two"><MapPin size={19} /></span>
          <span className="response-signal response-signal-three"><Siren size={19} /></span>
        </div>
        <div className="home-emergency-copy"><p className="eyebrow">{copy.sosEyebrow}</p><h2>{copy.sosTitle}</h2><p>{copy.sosText}</p><div className="home-emergency-actions"><Link className="button button-primary" to="/sos">{copy.sosButton} <Siren size={17} /></Link><Link className="button button-outline" to="/login">{copy.sosReportButton} <ArrowRight size={17} /></Link></div></div>
      </div>
    </section>
    <section className="section home-mobile-section motion-reveal">
      <div className="home-mobile-grid">
        <div className="home-mobile-copy"><p className="eyebrow">{copy.mobileEyebrow}</p><h2>{copy.mobileTitle}</h2><p>{copy.mobileText}</p><ul className="mobile-capability-list"><li><FileText size={17} />{copy.mobileReport}</li><li><Siren size={17} />{copy.mobileSos}</li><li><BellRing size={17} />{copy.mobileAlerts}</li><li><MapPin size={17} />{copy.mobileLocation}</li><li><ShieldCheck size={17} />{copy.mobileResources}</li></ul></div>
        <div className="phone-scene" aria-label={copy.mobileTitle}>
          <div className="phone-device"><div className="phone-screen"><div className="phone-status"><span>CampusSecure</span><ShieldCheck size={16} /></div><div className="phone-greeting"><span className="phone-greeting-mark"><ShieldCheck size={17} /></span><div><strong>CampusSecure</strong><small>{copy.mobileEyebrow}</small></div></div><div className="phone-sos"><Siren size={21} /><span>{copy.mobileSos}</span></div><div className="phone-app-grid"><span><FileText size={18} />{copy.mobileReport}</span><span><BellRing size={18} />{copy.mobileAlerts}</span><span><MapPin size={18} />{copy.mobileLocation}</span><span><ShieldCheck size={18} />{copy.mobileResources}</span></div><div className="phone-safe-note"><CheckCircle2 size={15} />{copy.whyMonitoring}</div></div></div>
        </div>
      </div>
    </section>
    <section className="section home-audience-section motion-reveal">
      <div className="section-heading"><div><p className="eyebrow">{copy.audienceEyebrow}</p><h2>{copy.audienceTitle}</h2></div></div>
      <div className="home-audience-grid">
        <article className="audience-card"><span className="audience-icon"><BrainCircuit size={24} /></span><h3>{copy.audienceStudents}</h3><p>{copy.audienceStudentsText}</p></article>
        <article className="audience-card"><span className="audience-icon"><ShieldCheck size={24} /></span><h3>{copy.audienceSecurity}</h3><p>{copy.audienceSecurityText}</p></article>
        <article className="audience-card"><span className="audience-icon"><LayoutDashboard size={24} /></span><h3>{copy.audienceAdmins}</h3><p>{copy.audienceAdminsText}</p></article>
        <article className="audience-card"><span className="audience-icon"><MapPin size={24} /></span><h3>{copy.audienceCommunity}</h3><p>{copy.audienceCommunityText}</p></article>
      </div>
    </section>
    <section className="section home-intelligence-section motion-reveal">
      <div className="home-intelligence-grid">
        <div className="home-intelligence-copy"><p className="eyebrow">{copy.intelligenceEyebrow}</p><h2>{copy.intelligenceTitle}</h2><p>{copy.intelligenceText}</p></div>
        <div className="intelligence-visual">
          <div className="intelligence-visual-heading"><span><Radar size={20} /></span><div><strong>CampusSecure</strong><small>{copy.intelligenceEyebrow}</small></div></div>
          <div className="intelligence-concepts">
            <div><span><FileText size={21} /></span><strong>{copy.intelligenceTrends}</strong></div>
            <div><span><Siren size={21} /></span><strong>{copy.intelligenceResponse}</strong></div>
            <div><span><LayoutDashboard size={21} /></span><strong>{copy.intelligenceAnalytics}</strong></div>
            <div><span><MapPin size={21} /></span><strong>{copy.intelligenceRisk}</strong></div>
          </div>
        </div>
      </div>
    </section>
    <section className="emergency-band">
      <div><p className="eyebrow">{copy.emergencyEyebrow}</p><h2>{copy.emergencyTitle}</h2></div>
      <Link className="button button-light" to="/contact">{copy.getInTouch} <ArrowRight size={17} /></Link>
    </section>
    <section className="home-final-cta motion-reveal">
      <img src="/images/campus-5.jpg" alt="" loading="lazy" />
      <div className="final-cta-overlay" />
      <div className="final-cta-content"><p className="eyebrow">{copy.finalEyebrow}</p><h2>{copy.finalTitle}</h2><div className="hero-actions"><Link className="button button-primary" to="/login">{copy.finalReport} <ArrowRight size={17} /></Link><Link className="button button-light" to="/about">{copy.finalLearn} <ChevronRight size={17} /></Link></div></div>
    </section>
  </div>;
}

function FeatureImageCarousel({ feature, index, language }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (feature.images.length < 2) return undefined;

    let startId;
    let intervalId;
    let transitionId;
    const stopRotation = () => {
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
      window.clearTimeout(transitionId);
      startId = undefined;
      intervalId = undefined;
      transitionId = undefined;
    };
    const startRotation = () => {
      if (motionPreference?.matches || startId !== undefined || intervalId !== undefined) return;
      startId = window.setTimeout(() => {
        startId = undefined;
        intervalId = window.setInterval(() => {
          setVisible(false);
          transitionId = window.setTimeout(() => {
            setImageIndex((currentIndex) => (currentIndex + 1) % feature.images.length);
            setVisible(true);
            transitionId = undefined;
          }, 260);
        }, 5200);
      }, index * 250);
    };
    const updateMotionPreference = () => {
      if (motionPreference.matches) {
        stopRotation();
        setVisible(true);
      } else {
        startRotation();
      }
    };

    startRotation();
    motionPreference?.addEventListener?.('change', updateMotionPreference);

    return () => {
      stopRotation();
      motionPreference?.removeEventListener?.('change', updateMotionPreference);
    };
  }, [feature, index]);

  return (
    <div className="feature-image-frame">
      <img
        key={feature.images[imageIndex]}
        className={`feature-image${visible ? ' is-visible' : ''}`}
        data-feature-id={feature.id}
        src={featureImagesPath(feature.images[imageIndex])}
        alt={featureTitle(feature, language)}
      />
    </div>
  );
}

function FeatureCard({ feature, index, language, revealIndex }) {
  const Icon = feature.icon;
  return (
    <article
      id={feature.id}
      className="feature-card"
      tabIndex="-1"
      style={revealIndex === undefined ? undefined : { '--reveal-delay': `${Math.min(revealIndex, 3) * 85}ms` }}
    >
      <FeatureImageCarousel feature={feature} index={index} language={language} />
      <div className="feature-icon"><Icon size={21} /></div>
      <h3>{featureTitle(feature, language)}</h3>
      <p>{featureText(feature, language)}</p>
      <span className="card-arrow"><ArrowRight size={16} /></span>
    </article>
  );
}

function AboutPage({ copy }) {
  return <PageFrame eyebrow={copy.aboutEyebrow} title={<>{copy.aboutTitleStart} <em>{copy.aboutTitleAccent}</em> {copy.aboutTitleEnd}</>} intro={copy.aboutIntro} pageClass="about-page">
    <div className="about-grid"><div className="about-visual"><div className="about-number">01</div><div><ShieldCheck size={38} /><p>{copy.aboutVisual}<br /><strong>{copy.aboutVisualAccent}</strong></p></div></div><div className="about-copy"><p id="about-purpose" tabIndex="-1">{copy.aboutParagraphOne}</p><p>{copy.aboutParagraphTwo}</p><div id="about-principles" className="about-points" tabIndex="-1"><span><CheckCircle2 size={17} /> {copy.aboutPointOne}</span><span><CheckCircle2 size={17} /> {copy.aboutPointTwo}</span><span><CheckCircle2 size={17} /> {copy.aboutPointThree}</span></div></div></div>
  </PageFrame>;
}

function FeaturesPage({ language, copy }) {
  return <PageFrame eyebrow={copy.featuresEyebrow} title={<>{copy.featuresTitle} <em>{copy.featuresTitleAccent}</em></>} intro={copy.featuresIntro} pageClass="features-page"><div className="feature-grid feature-grid-all">{features.map((feature, index) => <FeatureCard key={feature.id} feature={feature} index={index} language={language} />)}</div></PageFrame>;
}

function ContactPage({ copy }) {
  const [contactInformation, setContactInformation] = useState(null);
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/public-content/contact')
      .then((response) => {
        if (mounted) setContactInformation(response.data?.data || null);
      })
      .catch((error) => {
        if (mounted) setContactError(error.response?.data?.message || 'Unable to load contact information.');
      });
    return () => { mounted = false; };
  }, []);

  const phone = contactInformation?.phone || '';
  const email = contactInformation?.email || '';
  const location = contactInformation?.location || '';

  return (
    <PageFrame eyebrow={copy.contactEyebrow} title={<>{copy.contactTitle} <em>{copy.contactTitleAccent}</em></>} intro={copy.contactIntro} pageClass="contact-page">
      <div className="contact-grid">
        <div className="contact-details">
          {contactError && <p className="form-error" role="alert">{contactError}</p>}
          <div className="contact-card"><span className="feature-icon"><Phone size={19} /></span><div><small>{copy.phone}</small><strong><a href={phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined}>{phone || '—'}</a></strong></div></div>
          <div className="contact-card"><span className="feature-icon"><Mail size={19} /></span><div><small>{copy.email}</small><strong><a href={email ? `mailto:${email}` : undefined}>{email || '—'}</a></strong></div></div>
          <div className="contact-card"><span className="feature-icon"><MapPin size={19} /></span><div><small>{copy.location}</small><strong>{location || '—'}</strong></div></div>
          <div className="emergency-note"><Siren size={21} /><div><strong>{copy.immediateEmergency}</strong><p>{copy.emergencyInstructions}</p></div></div>
        </div>
        <ContactForm copy={copy} />
      </div>
      <section className="contact-map-section">
        <div className="contact-map-heading"><h2>{copy.location}</h2><p>{CONTACT_CAMPUS.name}</p></div>
        <div className="contact-map-frame" role="region" aria-label={`${copy.location}: ${CONTACT_CAMPUS.name}`}>
          <MapContainer center={[CONTACT_CAMPUS.latitude, CONTACT_CAMPUS.longitude]} zoom={17} maxZoom={19} scrollWheelZoom className="contact-campus-map">
            <ContactMapSizeHandler />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Satellite">
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Street">
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              </LayersControl.BaseLayer>
            </LayersControl>
            <CircleMarker
              center={[CONTACT_CAMPUS.latitude, CONTACT_CAMPUS.longitude]}
              radius={10}
              pane="markerPane"
              pathOptions={{ color: '#fff', weight: 4, fillColor: '#1e6b74', fillOpacity: 1 }}
            >
              <Popup>{CONTACT_CAMPUS.name}</Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      </section>
    </PageFrame>
  );
}

function ContactForm({ copy }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSent(false);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const value = (field) => String(formData.get(field) || '').trim();
    try {
      await api.post('/contact-messages', {
        name: value('name'),
        email: value('email'),
        topic: value('topic'),
        message: value('message'),
      });
      setSent(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <form className="contact-form" onSubmit={submit}><div className="form-row"><label>{copy.name}<input name="name" required placeholder={copy.yourName} /></label><label>{copy.email}<input name="email" required type="email" placeholder={copy.emailPlaceholder} /></label></div><label>{copy.howHelp}<select name="topic" required defaultValue=""><option value="" disabled>{copy.selectTopic}</option><option value="platform_information">{copy.platformInformation}</option><option value="campus_partnership">{copy.campusPartnership}</option><option value="technical_support">{copy.technicalSupport}</option></select></label><label>{copy.message}<textarea name="message" required rows="5" placeholder={copy.messagePlaceholder} /></label>{error && <p className="form-error" role="alert">{error}</p>}{sent && <p className="form-success"><CheckCircle2 size={16} /> {copy.messageCaptured}</p>}<button className="button button-primary" type="submit" disabled={submitting}>{copy.sendMessage} <ArrowRight size={17} /></button></form>;
}

function PageFrame({ eyebrow, title, intro, pageClass, children }) {
  return <main className={`inner-page ${pageClass}`}><div id={pageClass === 'about-page' ? 'about-overview' : undefined} className="page-heading" tabIndex="-1"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></div>{children}</main>;
}

export default function PublicSite({ user, onLogout, page = 'home' }) {
  const location = useLocation();
  const publicAppRef = useRef(null);
  const [language, setCurrentLanguage] = useLanguage();
  const copy = translations[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView?.({ block: 'start' });
    target?.focus?.({ preventScroll: true });
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (page === 'home' || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const main = publicAppRef.current?.querySelector('.inner-page');
    if (!main) return undefined;
    const targets = main.querySelectorAll('.page-heading, .feature-card, .about-visual, .about-copy > *, .contact-card, .emergency-note, .contact-form > *, .contact-form .form-row label, .contact-map-section');
    if (!targets.length) return undefined;

    const publicApp = publicAppRef.current;
    publicApp.classList.add('is-public-motion-ready');
    targets.forEach((target, index) => {
      target.classList.add('motion-reveal');
      target.style.setProperty('--reveal-delay', `${Math.min(index, 7) * 70}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      publicApp.classList.remove('is-public-motion-ready');
      targets.forEach((target) => {
        target.classList.remove('motion-reveal', 'is-visible');
        target.style.removeProperty('--reveal-delay');
      });
    };
  }, [page]);

  const content = page === 'about' ? <AboutPage copy={copy} /> : page === 'features' ? <FeaturesPage language={language} copy={copy} /> : page === 'contact' ? <ContactPage copy={copy} /> : <HomePage language={language} copy={copy} />;
  return <div ref={publicAppRef} className={`public-app${language === 'am' ? ' language-am' : ''}`} lang={language}><PublicNav user={user} onLogout={onLogout} language={language} onLanguageChange={setCurrentLanguage} copy={copy} />{content}<PublicFooter copy={copy} /></div>;
}

export function AuthPage({ mode, onLogin }) {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const [language] = useLanguage();
  const copy = translations[language];
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      if (!isLogin && form.password !== form.confirmPassword) throw new Error('Passwords do not match.');
      if (!isLogin && form.password.length < 8) throw new Error('Password must be at least 8 characters.');
      const response = await api.post(isLogin ? '/auth/login' : '/auth/register', isLogin ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, phone: form.phone, role: form.role });
      if (isLogin) {
        const { user, accessToken } = response.data.data;
        localStorage.setItem('token', accessToken); localStorage.setItem('user', JSON.stringify(user)); onLogin(user); navigate('/dashboard', { replace: true });
      } else { setSuccess('Account created. Redirecting you to sign in...'); setTimeout(() => navigate('/login'), 1200); }
    } catch (err) { setError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.'); } finally { setLoading(false); }
  };
  return (
    <div className="auth-page" lang={language}>
      <div className="auth-aside">
        <Link to="/" className="brand">
          <span className="brand-mark"><img src="/images/logo.png" alt="Mekdela Amba University logo" /></span>
          <span>Campus<span>Secure</span></span>
        </Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">{isLogin ? language === 'am' ? 'እንኳን ደህና መጡ' : 'Welcome back' : language === 'am' ? 'የምላሽ አውታረ መረቡን ይቀላቀሉ' : 'Join the response network'}</p>
          <h1>{isLogin ? language === 'am' ? <>የግቢዎን<br /><em>ደህንነት ይጠብቁ።</em></> : <>Keep your campus<br /><em>within reach.</em></> : language === 'am' ? <>የተሻለ ደህንነት<br /><em>በማሳወቅ ይጀምራል።</em></> : <>Better safety begins<br /><em>with a signal.</em></>}</h1>
          <p>{isLogin ? language === 'am' ? 'ክስተት ለማሳወቅ፣ ዝመናዎችን ለመከታተል ወይም የግቢዎን የምላሽ ቡድን ለመደገፍ ይግቡ።' : 'Sign in to report an incident, follow updates, or support your campus response team.' : language === 'am' ? 'ለፈጣን ሪፖርትና ለተቀናጀ የግቢ ማህበረሰብ በሚና የተመሠረተ መለያ ይፍጠሩ።' : 'Create a role-aware account for faster reporting and a more connected campus community.'}</p>
        </div>
        <div className="auth-aside-foot"><LockKeyhole size={16} /> {language === 'am' ? 'ለተፈቀደላቸው የግቢ አባላት ደህንነቱ የተጠበቀ መዳረሻ' : 'Secure access for authorized campus members'}</div>
      </div>
      <div className="auth-content">
        <Link className="back-home" to="/">{language === 'am' ? '← ወደ CampusSecure ይመለሱ' : '← Back to CampusSecure'}</Link>
        <div className="auth-form-wrap">
          {!isLogin && (
            <div className="register-logo-wrap">
              <img src="/images/logo.png" alt="Mekdela Amba University logo" />
            </div>
          )}
          <p className="eyebrow">{isLogin ? 'Secure sign in' : language === 'am' ? 'መለያዎን ይፍጠሩ' : 'Create your account'}</p>
          <h2>{isLogin ? 'Welcome back.' : language === 'am' ? 'CampusSecureን ይቀላቀሉ።' : 'Join CampusSecure.'}</h2>
          <p className="auth-description">{isLogin ? 'Use your campus account to continue.' : language === 'am' ? 'ለተማሪዎች፣ መምህራን እና ሠራተኞች የህዝብ ምዝገባ ይገኛል።' : 'Public registration is available for students, faculty, and staff.'}</p>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success"><CheckCircle2 size={16} /> {success}</div>}
          <form className="auth-form" onSubmit={submit}>
            {!isLogin && <label>{language === 'am' ? 'ሙሉ ስም' : 'Full name'}<input name="name" required value={form.name} onChange={update} placeholder={language === 'am' ? 'ሙሉ ስምዎን ያስገቡ' : 'Your full name'} /></label>}
            <label>{language === 'am' ? 'የግቢ ኢሜይል' : 'Campus email'}<input name="email" required type="email" value={form.email} onChange={update} placeholder="you@university.edu" /></label>
            {!isLogin && (
              <label>
                {copy.phoneNumber}
                <input name="phone" type="tel" value={form.phone} onChange={update} placeholder={copy.phonePlaceholder} />
              </label>
            )}
            <label>{language === 'am' ? 'የይለፍ ቃል' : 'Password'}<input name="password" required type="password" value={form.password} onChange={update} placeholder={language === 'am' ? 'ቢያንስ 8 ቁምፊዎች' : 'At least 8 characters'} /></label>
            {!isLogin && <><label>{language === 'am' ? 'የይለፍ ቃልን ያረጋግጡ' : 'Confirm password'}<input name="confirmPassword" required type="password" value={form.confirmPassword} onChange={update} placeholder={language === 'am' ? 'የይለፍ ቃልዎን ይድገሙ' : 'Repeat your password'} /></label><label>{language === 'am' ? 'ሚናዎ' : 'Your role'}<select name="role" value={form.role} onChange={update}><option value="student">{language === 'am' ? 'ተማሪ' : 'Student'}</option><option value="faculty">{language === 'am' ? 'መምህር' : 'Faculty'}</option><option value="staff">{language === 'am' ? 'ሠራተኛ' : 'Staff'}</option></select></label></>}
            <button className="button button-primary auth-submit" disabled={loading}>{loading ? language === 'am' ? 'እባክዎ ይጠብቁ...' : 'Please wait...' : isLogin ? 'Sign in to dashboard' : language === 'am' ? 'መለያ ይፍጠሩ' : 'Create account'} <ArrowRight size={17} /></button>
          </form>
          {!isLogin && (
            <OAuthButtons
              continueLabel={copy.continueWithGoogle}
              connectingLabel={copy.googleConnecting}
              dividerLabel={copy.authDivider}
              className="register-oauth-options"
            />
          )}
          <p className="auth-switch">{isLogin ? 'New to CampusSecure?' : language === 'am' ? 'መለያ አለዎት?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : language === 'am' ? 'ግባ' : 'Sign in'}</Link></p>
        </div>
      </div>
    </div>
  );
}