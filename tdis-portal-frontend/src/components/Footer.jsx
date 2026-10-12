import { trackOutboundClick } from '../utils/googleAnalytics.js';

const Footer = () => {
  return (
    <div className="py-1.5 px-5 bg-[#334755] flex justify-between items-center">
      <p className="text-white text-xs">TDIS © All rights reserved</p>
      <div className="flex items-center gap-4">
        <a
          href="https://www.glo.texas.gov/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOutboundClick('https://www.glo.texas.gov/')}
        >
          <img src="/glowhite.png" alt="Texas General Land Office official seal" className="h-12" />
        </a>
        <a
          href="https://www.tamu.edu/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOutboundClick('https://www.tamu.edu/')}
        >
          <img src="/tamulogo-white.png" alt="TAMU Logo" className="h-12" />
        </a>
      </div>
    </div>
  );
};

export default Footer;
