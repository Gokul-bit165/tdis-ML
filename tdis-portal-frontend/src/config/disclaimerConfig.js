/**
 * Disclaimer configuration for the TDIS Portal application
 * All content, images, and settings can be customized here
 */

export const disclaimerConfig = {
  // localStorage key for tracking acceptance
  storageKey: 'disclaimer_accepted',

  // Left panel configuration
  tdisLogo: '/tdislogo-white.png',
  tamuLogo: '/tamulogo-white.png',
  idrtLogo: '/IDRT_logo.png',
  footerPoweredBy: 'Powered by TDIS',

  // Right panel content
  welcomeText: 'Welcome to the',
  welcomeTitle: 'Texas Disaster Information System',
  informationText:
    'The Texas Disaster Information System (TDIS) provides comprehensive disaster information and planning tools for Texas communities.',
  informationLink: null, // Optional: 'https://example.com'
  informationLinkText: 'Learn more',

  // Disclaimer section
  disclaimerTitle: 'Disclaimer',
  disclaimerText: [
    'By accessing this website or its data, users release Texas A&M University (TAMU) and the Institute for Disaster Resilient Texas (IDRT) from all liability arising from its use. The Texas Disaster Information System (TDIS) and its applications are provided for noncommercial, informational, and planning purposes only. Although efforts are made to ensure accuracy, TAMU and IDRT make no warranties, express or implied, regarding the completeness, reliability, or suitability of the information provided.',
    'Users are responsible for independently verifying all information before making decisions. TAMU and IDRT do not guarantee continuous or error-free access and may modify or discontinue the tool at any time. The website may include third-party data or links, for which TAMU and IDRT assume no responsibility.',
    'Use of this tool does not constitute endorsement by any federal, state, or local agency. By using this site, users agree to these terms.',
  ],

  // Accept button
  acceptButtonText: 'I ACCEPT',
};
