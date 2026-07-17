  import { useState } from 'react';
  import { toast, ToastContainer } from 'react-toastify';

  const Footer = () => {
    const [email, setEmail] = useState('');
    const [comment, setComment] = useState('');

    const handleSend = (e) => {
      e.preventDefault();
      if (!email || !comment) {
        toast.error("Please fill in both fields.");
        return;
      }

      toast.success("Thank you for your feedback!");
      setEmail('');
      setComment('');
    };

    return (
      <div>
        <footer className="footer-main p-4 mt-4">
          <section className='row'>
            {/* About */}
            <div className='col-md-4'>
              <h3 className='text-dark'>About Us</h3>
              <p className='text-muted'>
                    Pesa Tracker is a student project built by a team at Strathmore University
    for our Web Application Development course. It's a personal finance
    tracking tool that helps users log expenses, visualize spending by
    category, and stay on top of their budget.
              </p>
            </div>

            {/* Contact */}
            <div className='col-md-4'>
              <h3 className='text-dark'>Comments</h3>
              <form onSubmit={handleSend}>
                <input
                  type="email"
                  placeholder='Enter your email'
                  className='form-control mb-3'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ borderRadius: '5px' }}
                />
                <textarea
                  placeholder="Leave a comment"
                  rows="8"
                  className="form-control mb-3"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={{ borderRadius: '5px' }}
                ></textarea>
                <button
                  type="submit"
                  className='btn btn-primary mt-2'
                  style={{ borderRadius: '5px', width: '100%' }}
                >
                  Send
                </button>
              </form>
            </div>

            {/* Social */}
            <div className='col-md-4'>
              <h3 className='text-dark'>Stay Connected</h3>
              <p className='text-muted'>Reach out to us through our social media platforms</p>
              <a href="https://web.facebook.com/" target="_blank" rel="noopener noreferrer" className="social-icon me-2">
                <img src="images/fb.png" alt="Facebook" width="25%" /> <br />
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="social-icon me-2">
                <img src="images/in.png" alt="Instagram" width="25%" />
              </a>
              <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="social-icon">
                <img src="images/x.png" alt="Twitter/X" width="25%" />
              </a>
            </div>
          </section>
        </footer>

        {/* Footer Bottom */}
        <div className="footer-bottom d-flex justify-content-between align-items-center py-2 px-3">
          <p className='mb-0'>&copy; 2026 Pesa Tracker Limited.</p>
          <a href="#top" className="text-warning text-decoration-none">
            Back to Top <i className="bi bi-arrow-up-circle-fill ms-1"></i>
          </a>
        </div>

        {/* Toast notifications and time duration it should be diplayed in microsecond*/}
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    );
  };

  export default Footer;
