// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicSite from './PublicSite';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}));

vi.mock('react-leaflet', async () => {
  const React = await import('react');

  const BaseLayer = ({ children }) => (
    <div data-testid="leaflet-base-layer">{children}</div>
  );

  const LayersControl = ({ children }) => (
    <div data-testid="leaflet-layers-control">{children}</div>
  );

  LayersControl.BaseLayer = BaseLayer;

  return {
    MapContainer: ({ children, center, zoom, ...props }) => (
      <div data-testid="leaflet-map" data-center={JSON.stringify(center)} data-zoom={zoom} {...props}>
        {children}
      </div>
    ),
    TileLayer: ({ url, attribution }) => <div data-testid="leaflet-tile-layer" data-url={url} data-attribution={attribution} />,
    CircleMarker: ({ children, center, radius }) => (
      <div data-testid="leaflet-circle-marker" data-center={JSON.stringify(center)} data-radius={radius}>{children}</div>
    ),
    Popup: ({ children }) => (
      <div data-testid="leaflet-popup">{children}</div>
    ),
    LayersControl,
    useMap: () => ({
      getContainer: () => document.createElement('div'),
      invalidateSize: vi.fn()
    })
  };
});
const featureIds = [
  'incident-reporting',
  'emergency-response',
  'ai-threat-recognition',
  'location-reporting',
  'alerts-notifications',
  'access-control',
  'incident-tracking',
  'analytics-monitoring'
];

function renderPublicSite(page = 'home') {
  const initialPath = page === 'home' ? '/' : `/${page}`;

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/about" element={<PublicSite page="about" />} />
        <Route path="/features" element={<PublicSite page="features" />} />
        <Route path="/contact" element={<PublicSite page="contact" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  api.get.mockReset();
  api.post.mockReset();
  api.post.mockResolvedValue({ data: { success: true } });
  api.get.mockResolvedValue({
    data: { data: { phone: '0976296127', email: 'yaekobshitaw@gmail.com', location: 'Tuluawulia' } }
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Public site', () => {
  it('renders all eight home feature cards and the existing home sections', () => {
    const { container } = renderPublicSite();

    const heroTitle = container.querySelector('.hero-title');
    expect(heroTitle).toBeInTheDocument();
    expect(heroTitle.tagName).toBe('H1');
    expect(heroTitle).toHaveClass('hero-title');
    expect(screen.getByText('One system for')).toBeInTheDocument();
    expect(container.querySelectorAll('.feature-card')).toHaveLength(8);
    expect(container.querySelectorAll('.feature-image')).toHaveLength(8);
    featureIds.forEach((id) => expect(container.querySelector(`#${id}`)).toBeInTheDocument());
    expect(container.querySelectorAll('.visual-slide')).toHaveLength(6);
    expect(container.querySelector('.visual-slide img[src="/images/campus-security-home.jpg"]')).toHaveAttribute(
      'alt',
      'Elevated view of the university campus, buildings, and pathways.'
    );
    expect(container.querySelector('.public-footer')).toBeInTheDocument();
  });

  it('renders public published announcements and active content from nested API response arrays', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/announcements/public') return Promise.resolve({ data: { data: { items: [
        { announcement_id: 'published', title: 'Campus notice', content: 'Gate hours updated.', status: 'published', is_public: true },
        { announcement_id: 'draft', title: 'Draft notice', content: 'Not public.', status: 'draft', is_public: true },
        { announcement_id: 'private', title: 'Private notice', content: 'Not public.', status: 'published', is_public: false },
        { announcement_id: 'expired', title: 'Expired notice', content: 'No longer current.', status: 'published', is_public: true, expires_at: new Date(Date.now() - 1000).toISOString() }
      ] } } });
      return Promise.resolve({ data: { data: { items: [
        { content_id: 'faq-1', type: 'faq', title: 'How do I report?', body: 'Use the report form.', is_active: true },
        { content_id: 'resource-1', type: 'safety_resource', title: 'Safety guide', url: 'https://example.edu/safety', is_active: true },
        { content_id: 'contact-1', type: 'emergency_contact', title: 'Campus security', contact_name: 'Security desk', phone: '+251 900 000 000', is_active: true },
        { content_id: 'service-1', type: 'service', title: 'Walk-home service', summary: 'Request an escort.', is_active: true },
        { content_id: 'inactive', type: 'faq', title: 'Hidden entry', is_active: false }
      ] } } });
    });

    renderPublicSite();

    expect(await screen.findByRole('heading', { name: 'Campus notice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How do I report?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Safety guide' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+251 900 000 000' })).toHaveAttribute('href', 'tel:+251900000000');
    expect(screen.getByRole('heading', { name: 'Walk-home service' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Draft notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Private notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Expired notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hidden entry' })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/announcements/public');
    expect(api.get).toHaveBeenCalledWith('/public-content');
  });

  it('does not duplicate public requests when StrictMode replays effects', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <PublicSite />
        </MemoryRouter>
      </StrictMode>
    );

    expect(await screen.findByText('There are no public announcements right now.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledWith('/announcements/public');
    expect(api.get).toHaveBeenCalledWith('/public-content');
  });

  it('shows a public content load error and allows retrying the request', async () => {
    api.get.mockImplementation((url) => url === '/public-content'
      ? Promise.reject({ response: { data: { message: 'Public content is unavailable.' } } })
      : Promise.resolve({ data: { data: [] } }));
    renderPublicSite();

    expect(await screen.findByRole('alert')).toHaveTextContent('Public content is unavailable.');
    api.get.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4));
    expect(await screen.findByText('No active public entries in this section.')).toBeInTheDocument();
  });

  it('shows an announcement load error and retries the public request', async () => {
    api.get.mockImplementation((url) => url === '/announcements/public'
      ? Promise.reject({ response: { data: { message: 'Announcements are unavailable.' } } })
      : Promise.resolve({ data: { success: true, data: [] } }));
    renderPublicSite();

    expect(await screen.findByRole('alert')).toHaveTextContent('Announcements are unavailable.');
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4));
    expect(await screen.findByText('There are no public announcements right now.')).toBeInTheDocument();
  });

  it('centers the existing Facebook icon link in the public footer', () => {
    renderPublicSite();

    const facebookLink = screen.getByRole('link', { name: 'Facebook' });
    expect(facebookLink).toHaveAttribute('aria-label', 'Facebook');
    expect(facebookLink).toHaveClass('footer-social-link', 'footer-social-center');
    expect(facebookLink.parentElement).toHaveClass('footer-grid');
  });

  it('cycles through all 24 mapped feature images, three per feature', () => {
    vi.useFakeTimers();
    const { container } = renderPublicSite();
    const seenByFeature = new Map(featureIds.map((id) => [id, new Set()]));
    const recordVisibleImages = () => {
      container.querySelectorAll('.feature-image').forEach((image) => {
        seenByFeature.get(image.dataset.featureId).add(image.getAttribute('src'));
      });
    };

    recordVisibleImages();
    act(() => vi.advanceTimersByTime(7800));
    recordVisibleImages();
    act(() => vi.advanceTimersByTime(5700));
    recordVisibleImages();

    expect(seenByFeature.size).toBe(8);
    seenByFeature.forEach((images, id) => {
      expect(images).toHaveLength(3);
      expect([...images].every((src) => new RegExp(`/images/features/${id}-[123]\\.jpg$`).test(src))).toBe(true);
    });
    expect(new Set([...seenByFeature.values()].flatMap((images) => [...images]))).toHaveLength(24);
  });

  it('keeps feature slides still when reduced motion is preferred', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    const { container } = renderPublicSite();

    act(() => vi.advanceTimersByTime(15000));

    container.querySelectorAll('.feature-image').forEach((image) => {
      expect(image.getAttribute('src')).toMatch(new RegExp(`${image.dataset.featureId}-1\\.jpg$`));
    });
  });

  it('exposes About destinations and all eight Features in the navigation dropdowns', () => {
    renderPublicSite();

    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByRole('menuitem', { name: 'Overview' })).toHaveAttribute('href', '/about#about-overview');
    expect(screen.getByRole('menuitem', { name: 'Our purpose' })).toHaveAttribute('href', '/about#about-purpose');
    expect(screen.getByRole('menuitem', { name: 'Our commitments' })).toHaveAttribute('href', '/about#about-principles');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Our purpose' }));
    expect(screen.getByRole('heading', { name: /Designed for people/ })).toBeInTheDocument();
    const aboutCarousel = document.querySelector('.about-page')?.previousElementSibling;
    expect(aboutCarousel).toHaveClass('page-image-carousel');
    expect(aboutCarousel).toHaveAttribute('aria-label', 'About campus images');
    expect(aboutCarousel.querySelectorAll('.page-image-slide img')).toHaveLength(2);
    expect(aboutCarousel.querySelector('.page-image-slide img[src="/images/campus-security-about-1.jpg"]')).toHaveAccessibleName(
      'Campus footpaths and landscaped grounds around a university building.'
    );
    expect(aboutCarousel.previousElementSibling).toHaveClass('public-nav-wrap');
    expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Features' }));
    const featureMenuItems = screen.getAllByRole('menuitem').filter((item) => item.getAttribute('href')?.startsWith('/features#'));
    expect(featureMenuItems).toHaveLength(8);
    featureIds.forEach((id) => expect(featureMenuItems.some((item) => item.getAttribute('href') === `/features#${id}`)).toBe(true));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Emergency Response' }));
    expect(screen.getByRole('heading', { name: /A complete picture of/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.features-page .feature-card')).toHaveLength(8);
  });


  it('automatically cycles the About carousel and supports manual image selection', () => {
    vi.useFakeTimers();
    const { container } = renderPublicSite('about');
    const carousel = container.querySelector('.page-image-carousel');

    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-1.jpg'
    );
    act(() => vi.advanceTimersByTime(1499));
    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-1.jpg'
    );
    act(() => vi.advanceTimersByTime(1));
    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-2.jpg'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show image 1' }));
    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-1.jpg'
    );
  });

  it('automatically cycles the Contact carousel every 1500 milliseconds', () => {
    vi.useFakeTimers();
    const { container } = renderPublicSite('contact');
    const carousel = container.querySelector('.page-image-carousel');

    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-contact.jpg'
    );
    act(() => vi.advanceTimersByTime(1499));
    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-contact.jpg'
    );
    act(() => vi.advanceTimersByTime(1));
    expect(carousel.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-1.jpg'
    );
  });

  it('clears the page carousel interval when the page unmounts', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderPublicSite('about');
    const intervalId = setIntervalSpy.mock.results[0].value;

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });

  it('does not automatically cycle page carousels when reduced motion is preferred', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    const { container } = renderPublicSite('about');

    act(() => vi.advanceTimersByTime(12000));

    expect(container.querySelector('.page-image-slide.is-active img')).toHaveAttribute(
      'src',
      '/images/campus-security-about-1.jpg'
    );
  });

  it('switches public content to Amharic and persists the selection', () => {
    const { unmount } = renderPublicSite();

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'am' }
    });

    const homeHeading = screen.getByRole('heading', { level: 1 });
    expect(homeHeading).toBeInTheDocument();
    expect(homeHeading.textContent.trim()).not.toBe('');

    expect(localStorage.getItem('campussecure-language')).toBe('am');
    expect(document.documentElement).toHaveAttribute('lang', 'am');

    unmount();
    const { container: featuresContainer } = renderPublicSite('features');

    const featuresHeading = screen.getByRole('heading', { level: 1 });
    expect(featuresHeading).toBeInTheDocument();
    expect(featuresHeading.textContent.trim()).not.toBe('');

    expect(featuresContainer.querySelector('.language-switcher select')).toHaveValue('am');

    fireEvent.click(featuresContainer.querySelector('.nav-features-dropdown .nav-dropdown-trigger'));

    expect(
      featuresContainer.querySelector('.nav-features-dropdown [role="menuitem"][href="/features#incident-reporting"]')
    ).toBeInTheDocument();
  });
  it('displays saved Contact Us information fetched from the public content API', async () => {
    api.get.mockResolvedValue({
      data: { data: { phone: '0123456789', email: 'saved@example.com', location: 'Updated campus' } }
    });
    renderPublicSite('contact');

    expect(await screen.findByRole('link', { name: '0123456789' })).toHaveAttribute('href', 'tel:0123456789');
    expect(screen.getByRole('link', { name: 'saved@example.com' })).toHaveAttribute('href', 'mailto:saved@example.com');
    expect(screen.getByText('Updated campus')).toBeInTheDocument();
    const contactCarousel = document.querySelector('.contact-page')?.previousElementSibling;
    expect(contactCarousel).toHaveClass('page-image-carousel');
    expect(contactCarousel.querySelectorAll('.page-image-slide img')).toHaveLength(3);
    expect(contactCarousel.previousElementSibling).toHaveClass('public-nav-wrap');
    expect(contactCarousel.nextElementSibling.querySelector('.contact-grid')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Campus location collage with two campus views and Amharic map notes.' }))
      .toHaveAttribute('src', '/images/campus-security-contact.jpg');
    expect(api.get).toHaveBeenCalledWith('/public-content/contact');
  });

  it('centers the Contact Us satellite map on campus with correctly ordered Esri tiles', () => {
    renderPublicSite('contact');

    const coordinates = [10.9854535, 39.2631819];
    const map = screen.getByTestId('leaflet-map');
    const satelliteLayer = screen.getAllByTestId('leaflet-tile-layer')[0];
    const marker = screen.getByTestId('leaflet-circle-marker');

    expect(JSON.parse(map.dataset.center)).toEqual(coordinates);
    expect(map.dataset.zoom).toBe('17');
    expect(JSON.parse(marker.dataset.center)).toEqual(coordinates);
    expect(marker.dataset.radius).toBe('10');
    expect(satelliteLayer.dataset.url).toBe('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    expect(satelliteLayer.dataset.attribution).toContain('Esri');
    expect(screen.getAllByTestId('leaflet-tile-layer')[1].dataset.url).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('submits Contact Us details and keeps the existing success message', async () => {
    renderPublicSite('contact');
    fireEvent.change(await screen.findByPlaceholderText('Your name'), { target: { value: 'Alex Example' } });
    fireEvent.change(screen.getByPlaceholderText('you@university.edu'), { target: { value: 'alex@example.edu' } });
    fireEvent.change(screen.getByLabelText('How can we help?'), { target: { value: 'campus_partnership' } });
    fireEvent.change(screen.getByPlaceholderText('Tell us a little about your campus...'), { target: { value: 'Please contact our campus team.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/contact-messages', {
      name: 'Alex Example',
      email: 'alex@example.edu',
      topic: 'campus_partnership',
      message: 'Please contact our campus team.',
    }));
    expect(await screen.findByText('Message captured. Your security office can follow up through its established channel.')).toBeInTheDocument();
  });

  it('shows a submission error without displaying the success message', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Unable to submit your message.' } } });
    renderPublicSite('contact');
    fireEvent.change(await screen.findByPlaceholderText('Your name'), { target: { value: 'Alex Example' } });
    fireEvent.change(screen.getByPlaceholderText('you@university.edu'), { target: { value: 'alex@example.edu' } });
    fireEvent.change(screen.getByLabelText('How can we help?'), { target: { value: 'technical_support' } });
    fireEvent.change(screen.getByPlaceholderText('Tell us a little about your campus...'), { target: { value: 'Help with login.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to submit your message.');
    expect(screen.queryByText('Message captured. Your security office can follow up through its established channel.')).not.toBeInTheDocument();
  });
});
