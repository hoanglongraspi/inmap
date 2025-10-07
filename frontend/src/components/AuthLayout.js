import "../styles/auth.css";
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-dot" />
          <div>
            <div className="auth-title">{title}</div>
            {subtitle && <div className="auth-sub">{subtitle}</div>}
          </div>
        </div>
        {children}
        <div style={{marginTop:16}} className="note">
          Need access? Email <a href="mailto:support@example.com">support@example.com</a>
        </div>
      </div>
    </div>
  );
}
