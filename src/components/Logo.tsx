import logo from "@/assets/logo-aptransp.png";

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <img src={logo} alt="APTRANSP" className={className} />
);
