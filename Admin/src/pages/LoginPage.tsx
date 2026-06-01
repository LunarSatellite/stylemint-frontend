import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/store'
import { PhoneMockupAnimation } from '@/components/PhoneMockupAnimation'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

const HARDCODED_EMAIL    = 'admin@stylemint.com'
const HARDCODED_PASSWORD = 'Admin@123'

const FAKE_TOKEN = (() => {
  const header  = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub:   'admin-001',
    jti:   'local-jti-001',
    email: 'admin@stylemint.com',
    roles: ['SuperAdmin'],
    exp:   9999999999,
  }))
  return `${header}.${payload}.fake`
})()

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const setToken  = useAuth((s) => s.setToken)
  const navigate  = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email === HARDCODED_EMAIL && password === HARDCODED_PASSWORD) {
      setToken(FAKE_TOKEN)
      navigate('/', { replace: true })
    } else {
      setError('Invalid email or password.')
    }
  }

  return (
    <div style={{ display:'flex', height:'100vh', minWidth:1280 }}>

      {/* ── Left panel: phone mockup animation ── */}
      <div style={{ width:'60%', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, background:'radial-gradient(ellipse at 40% 50%, #0F1E1A 0%, #0A1612 100%)' }}>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:3, textTransform:'uppercase', color:'#7A9B8E', marginBottom:6 }}>
            Powering the creator economy
          </div>
          <div style={{ fontSize:15, color:'#B8E6D5', opacity:0.65 }}>
            One platform. Brands and creators, in sync.
          </div>
        </div>

        <PhoneMockupAnimation />

        <div style={{ display:'flex', gap:36 }}>
          {[
            { v:'2.4K+', l:'Creators' },
            { v:'180+',  l:'Brands'   },
            { v:'$4.2M', l:'GMV'      },
          ].map((s) => (
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:17, fontWeight:800, color:'#00D98A' }}>{s.v}</div>
              <div style={{ fontSize:12, color:'#7A9B8E' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width:1, background:'rgba(255,255,255,0.06)', flexShrink:0 }} />

      {/* ── Right panel: login form ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0A1612', gap:28 }}>

        {/* Logo — above the card, matching screenshot layout */}
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Icon box */}
          <div style={{ width:64, height:64, borderRadius:14, background:'#0F2A1E', border:'1px solid rgba(0,217,138,0.18)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px rgba(0,217,138,0.12)', flexShrink:0 }}>
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              {/* S shape: two arcs */}
              <path d="M8 19 C8 12 11 7 19 7 C27 7 30 12 30 16 C30 21 27 23 19 23"
                    stroke="#00D98A" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
              <path d="M30 22 C30 29 27 31 19 31 C11 31 8 26 8 22 C8 17 11 15 19 15"
                    stroke="#00D98A" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
              {/* Glow layers */}
              <path d="M8 19 C8 12 11 7 19 7 C27 7 30 12 30 16 C30 21 27 23 19 23"
                    stroke="#00D98A" strokeWidth="7" strokeLinecap="round" fill="none" strokeOpacity="0.07"/>
              <path d="M30 22 C30 29 27 31 19 31 C11 31 8 26 8 22 C8 17 11 15 19 15"
                    stroke="#00D98A" strokeWidth="7" strokeLinecap="round" fill="none" strokeOpacity="0.07"/>
              <circle cx="19" cy="19" r="2.2" fill="#00D98A"/>
            </svg>
          </div>
          {/* Name + subtitle */}
          <div>
            <div style={{ fontSize:28, fontWeight:800, color:'#ffffff', letterSpacing:'-0.3px', lineHeight:1.15 }}>StyleMint</div>
            <div style={{ fontSize:13, color:'#7A9B8E', fontWeight:500, marginTop:3, letterSpacing:'0.02em' }}>AI-Powered Analytics</div>
          </div>
        </div>

        {/* Card */}
        <div style={{ width:'100%', maxWidth:400, background:'#132420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'36px 32px', boxShadow:'0 4px 32px rgba(0,0,0,0.45)', position:'relative' }}>
          {/* Shimmer top edge */}
          <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg, transparent, rgba(0,217,138,0.4), transparent)', borderRadius:99 }} />

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* Email */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <label style={{ fontSize:13, fontWeight:600, color:'#B8E6D5' }}>Email address</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} color="#4A7A6A" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setError(null); setEmail(e.target.value) }}
                  placeholder="@stylemint.com"
                  autoComplete="email"
                  required
                  style={{ width:'100%', background:'#1A332C', border:'1px solid rgba(184,230,213,0.1)', borderRadius:10, padding:'11px 14px 11px 38px', fontSize:13, color:'#ffffff', outline:'none', transition:'border-color 0.18s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(0,217,138,0.45)' }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(184,230,213,0.1)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <label style={{ fontSize:13, fontWeight:600, color:'#B8E6D5' }}>Password</label>
                <button type="button" style={{ fontSize:12, color:'#00D98A', background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:500 }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position:'relative' }}>
                <Lock size={15} color="#4A7A6A" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setError(null); setPassword(e.target.value) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{ width:'100%', background:'#1A332C', border:'1px solid rgba(184,230,213,0.1)', borderRadius:10, padding:'11px 42px 11px 38px', fontSize:13, color:'#ffffff', outline:'none', transition:'border-color 0.18s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(0,217,138,0.45)' }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(184,230,213,0.1)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#4A7A6A', padding:3, display:'flex', alignItems:'center' }}
                >
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, padding:'9px 13px', fontSize:13, color:'#f87171' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{ background:'#00D98A', color:'#0A1612', fontWeight:700, fontSize:14, padding:'13px', borderRadius:10, border:'none', cursor:'pointer', marginTop:2, transition:'background 0.18s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#00B872' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#00D98A' }}
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
