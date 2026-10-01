// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(container.querySelectorAll('.visual-slide')).toHaveLength(5);
    expect(container.querySelector('.public-footer')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'About' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Features' }));
    const featureMenuItems = screen.getAllByRole('menuitem').filter((item) => item.getAttribute('href')?.startsWith('/features#'));
    expect(featureMenuItems).toHaveLength(8);
    featureIds.forEach((id) => expect(featureMenuItems.some((item) => item.getAttribute('href') === `/features#${id}`)).toBe(true));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Emergency Response' }));
    expect(screen.getByRole('heading', { name: /A complete picture of/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.features-page .feature-card')).toHaveLength(8);
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
