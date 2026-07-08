import { Link, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useState, useEffect } from "react";
import axios from 'axios';
import Footer from './Footer';

const SignUp = ({ setUser }) => {
  const [Username, setUsername] = useState("");
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [ConfirmPassword, setConfirmPassword] = useState("");
  const [Phone, setPhone] = useState("");

  const [Success, setSuccess] = useState("");
  const [Loading, setLoading] = useState(false);
  const [Error, setError] = useState("");
  const [PasswordStrength, setPasswordStrength] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    document.getElementById("username")?.focus();
  }, []);

  const checkPasswordStrength = (password) => {
    let strength = "";
    if (password.length < 6) strength = "Weak";
    else if (/[A-Z]/.test(password) && /\d/.test(password) && /[\W]/.test(password))
      strength = "Strong";
    else strength = "Moderate";
    setPasswordStrength(strength);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (Password !== ConfirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", Username);
      formData.append("email", Email);
      formData.append("password", Password);
      formData.append("phone", Phone);

      const response = await axios.post(
        "https://Joshu.pythonanywhere.com/api/signup",
        formData
      );

      setLoading(false);
      setSuccess(response.data.Success || "Registration successful");

      if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
        setUser && setUser(response.data.user);
      }
      navigate("/", { replace: true });

      // Clear form
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setPhone("");
    } catch (error) {
      setLoading(false);
      setError("Error: " + error.message);
    }
  };

  return (
    <div className="auth-page">
      <div className='row justify-content-center'>
        <div className="col-md-6 auth-card shadow-lg p-5 rounded-4">
          <h2 className="text-center mb-4 text-primary">Create Your Account</h2>

          {Error && <div className="alert alert-danger">{Error}</div>}
          {Success && <div className="alert alert-success">{Success}</div>}

          <form onSubmit={submit} className="mb-3">

            {/* Username */}
            <div className="form-group mb-3">
              <label htmlFor="username" className="form-label">
                <i className="bi bi-person-fill me-1"></i> Username
              </label>
              <input
                id="username"
                type="text"
                className="form-control"
                value={Username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="form-group mb-3">
              <label htmlFor="email" className="form-label">
                <i className="bi bi-envelope-fill me-1"></i> Email
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={Email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <small className="form-text text-muted">We'll never share your email.</small>
            </div>

            {/* Password */}
            <div className="form-group mb-3">
              <label htmlFor="password" className="form-label">
                <i className="bi bi-lock-fill me-1"></i> Password
              </label>
              <div className="input-group">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={Password}
                  onChange={e => {
                    setPassword(e.target.value);
                    checkPasswordStrength(e.target.value);
                  }}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword(p => !p)}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
              {Password && (
                <small className={
                  PasswordStrength === "Strong" ? "text-success" :
                  PasswordStrength === "Moderate" ? "text-warning" : "text-danger"
                }>
                  Password strength: {PasswordStrength}
                </small>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group mb-3">
              <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
              <div className="input-group">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className={`form-control ${ConfirmPassword && Password !== ConfirmPassword ? 'is-invalid' : ''}`}
                  value={ConfirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowConfirmPassword(p => !p)}
                >
                  <i className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
              {ConfirmPassword && Password !== ConfirmPassword && (
                <div className="invalid-feedback">Passwords do not match</div>
              )}
            </div>

            {/* Phone */}
            <div className="form-group mb-4">
              <label htmlFor="phone" className="form-label">
                <i className="bi bi-telephone-fill me-1"></i> Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                className="form-control"
                placeholder="e.g. +254712345678"
                value={Phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
              disabled={Loading}
            >
              {Loading && (
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              )}
              {Loading ? "Signing Up…" : "Sign Up"}
            </button>
          </form>

          <p className="text-center">
            Already have an account? <Link to='/SignIn'>Sign In</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignUp;
