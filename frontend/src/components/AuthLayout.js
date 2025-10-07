import "../styles/auth.css";
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-header">
          <img 
            src="/logo.png" 
            alt="Customer Atlas Logo" 
            style={{
              height: '60px',
              width: 'auto',
              objectFit: 'contain',
              marginBottom: '20px'
            }}
          />
          <div>
            <div className="auth-title">Customer Atlas</div>
            <div className="auth-sub" style={{marginBottom: '16px'}}>Map-Driven CRM for Outreach</div>
            <div className="auth-title" style={{fontSize: '20px', marginTop: '12px'}}>{title}</div>
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
