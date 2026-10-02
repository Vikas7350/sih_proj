import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NetraCare PHC Screening Platform',
    short_name: 'NetraCare',
    description: 'AI-assisted Diabetic Retinopathy screening and triage for Primary Health Centres',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F3F6F5',
    theme_color: '#0B3A3F',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
