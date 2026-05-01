import 'leaflet/dist/leaflet.css';
import './styles.css';

export const metadata = {
  title: 'Macless Haystack',
  description: 'Macless Haystack — local-first AirTag tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
