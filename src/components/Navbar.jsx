import { Link } from "react-router-dom";

const Navbar = ({ isAuthenticated, logout, darkMode, setDarkMode }) => {
  return (

    <div>
      <header>
        <h1 className="logo text-center">Pesa Tracker</h1>
      </header>

      <section className='row'>
        <div className='col-md-12'>
            <nav className='navbar navbar-expand-md custom-navbar shadow-sm'>
            <button className="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navbarcollapse">
              <span className="navbar-toggler-icon"></span>
            </button>

            <div className="collapse navbar-collapse justify-content-center" id="navbarcollapse">
                <div className="navbar-nav">

                    {isAuthenticated ? (
                        <>
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to="/upload"><i className="bi bi-upload me-2"></i>Upload</Link>
                            </button> &nbsp;
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to="/dashboard"><i className="bi bi-speedometer2 me-2"></i>Dashboard</Link>
                            </button> &nbsp;
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to='/ContactUs'>Contact Us</Link>
                            </button> &nbsp;

                            {/* logout button */}
                            <button className='btn1' onClick={logout}>Logout</button>
                        </>
                    ):(
                        <>
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to='/'>
                                <i className="bi bi-house-door-fill me-2"></i>Home
                                </Link>
                            </button> &nbsp;
                           <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to="/SignIn">Sign In</Link>
                            </button> &nbsp;
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to="/SignUp">Sign Up</Link>
                            </button> &nbsp;
                            <button className='btn1'>
                                <Link className='App-link text-light text-decoration-none' to='/ContactUs'>Contact Us</Link>
                            </button> &nbsp;
                        </>
                    )}

                    {/* Theme Toggle */}
                    <button className="theme-btn ms-3" onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? "☀" : "🌙"}
                    </button>

                </div>
            </div>
            </nav>
        </div>
      </section>
    </div>
  );
};

export default Navbar;