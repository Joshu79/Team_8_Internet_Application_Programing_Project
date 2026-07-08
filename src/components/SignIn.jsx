import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useState } from 'react';
import Footer from './Footer';

const SignIn = ({ setUser }) => {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [ShowPassword, setShowPassword] = useState(false);
  const [Loading, setLoading] = useState(false);
  const [Error, setError] = useState("");
  const navigate = useNavigate();

  const togglePasswordVisibility = () => setShowPassword(p => !p);

  const submit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Temporary test account
      const fakeUser = {
      id: 1,
      email: "pesatrack@gmail.com",
      name: "Developer"
    };

    localStorage.setItem("user", JSON.stringify(fakeUser));
    setUser(fakeUser);
    navigate("/", { replace: true });
  }
    catch (err) {
    console.log(err);
  }
  };

  return (
    <div className="auth-page">
      <div className='row justify-content-center'>
        <div className="col-md-6 auth-card shadow-lg p-5 rounded-4">
          <div className="card-header bg-primary text-white text-center rounded-4">
            <h3>Welcome Back</h3>
            <p className="mb-0">Please sign in to continue</p>
          </div>
          <br />
          <form onSubmit={submit}>
            {Error && <div className="alert alert-danger">{Error}</div>}

            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email Address</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-envelope-fill"></i></span>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="Enter Email"
                  value={Email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                <input
                  id="password"
                  type={ShowPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Enter Password"
                  value={Password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  aria-describedby="togglePassword"
                />
                <button
                  id="togglePassword"
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={togglePasswordVisibility}
                  aria-label={ShowPassword ? "Hide password" : "Show password"}
                >
                  <i className={ShowPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
              disabled={Loading}
              style={{
                transition: '0.2s', 
                transform: 'scale(1)',
                borderRadius: '5px'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              {Loading && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              )}
              {Loading ? "Signing In…" : "Sign In"}
            </button>

            <p className='text-center mt-4'>
              Don't have an account? <Link to='/SignUp'>Sign Up</Link>
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignIn;
