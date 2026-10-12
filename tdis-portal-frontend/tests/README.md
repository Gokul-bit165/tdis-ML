# Unit Tests

Unit tests are organized **by feature** and aim for **80–85% coverage**. The current suite gives a solid baseline (~40% overall); raise the thresholds in `vitest.config.js` as you add tests for more modules.

## Structure

```
tests/
├── setup.js                 # Global mocks (matchMedia, ResizeObserver, IntersectionObserver, scrollTo)
├── mocks/                   # Optional mocks (e.g. framer-motion)
└── features/
    ├── app/                 # App root, routing, disclaimer state
    ├── api/                 # RTK Query API (services/api)
    ├── config/              # App config (e.g. disclaimerConfig)
    ├── disclaimer/          # Disclaimer component
    ├── layout/              # Header, Footer, Loading, LastUpdated, ScrollToTop
    ├── components/         # TabNavigation, DisclaimerFooter
    ├── hooks/              # use-mobile, useDraggable
    ├── lib/                 # lib/utils (cn)
    ├── services/           # apiClient
    ├── store/              # Redux store
    └── utils/              # dateUtils, logger, eventUtils, time, toast, googleAnalytics, mapUtils, osaUtils
```

## Commands

- `npm run test` — watch mode
- `npm run test:run` — single run
- `npm run test:coverage` — run with coverage report

## Coverage

Coverage thresholds are set at a baseline that passes with the current suite. To move toward **80–85%**:

1. Add tests for remaining components (ContactUs, EmailSubscriptionForm, MainLayout, etc.).
2. Add tests for services (eventService, hazardService, intakeService, powerOutageService) with mocked fetch/API.
3. Add tests for config (hazardConfig, weatherEventsConfig) and more utils as needed.
4. Map/Mapbox-heavy code (e.g. `useMapboxMap`, `MapSection`, OSA/HMED tabs) is excluded from coverage; add integration or E2E tests if required.
