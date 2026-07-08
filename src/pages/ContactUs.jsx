import React, { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import Footer from '../components/Footer';

const ContactUs = () => {
  useEffect(() => {
    AOS.init({
      duration: 1200,
      easing: 'ease-in-out',
      once: true,
      mirror: false,
    });
  }, []);

  return (
    <div>
      <main className="main">
        {/* Page Title */}
        <div className="page-title-section" data-aos="fade-down">
          <div className="container-fluid">
            <br />
            <h1 className="contact-title">Get in Touch</h1>
            <p className="contact-subtitle">
              We would love to hear from you! Whether you have questions, feedback, or suggestions — reach out anytime.
            </p>
          </div>
        </div>
        <br />
        <br />

        {/* Contact Info Cards */}
        <section id="contact" className="contact section">
          <div className="container-fluid">
            <div className="row gy-4 mb-5">
              <div className="col-lg-4" data-aos="fade-up" data-aos-delay="100">
                <div className="info-card elegant-card rounded-4 shadow-sm">
                  <div className="icon-circle bg-gradient-purple">
                    <i className="bi bi-geo-alt-fill"></i>
                  </div>
                  <h4>Address</h4>
                  <p>Nairobi, Kenya</p>
                </div>
              </div>

              <div className="col-lg-4" data-aos="fade-up" data-aos-delay="200">
                <div className="info-card elegant-card rounded-4 shadow-sm">
                  <div className="icon-circle bg-gradient-blue">
                    <i className="bi bi-telephone-fill"></i>
                  </div>
                  <h4>Contact</h4>
                  <p>
                    +254 (222) 333-777<br />
                    info@pesatracker.com
                  </p>
                </div>
              </div>

              <div className="col-lg-4" data-aos="fade-up" data-aos-delay="300">
                <div className="info-card elegant-card rounded-4 shadow-sm">
                  <div className="icon-circle bg-gradient-green">
                    <i className="bi bi-clock-fill"></i>
                  </div>
                  <h4>Hours</h4>
                  <p>
                    Mon - Sat: 9:00 - 18:00<br />
                    Sunday: Closed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    </div>
  );
};

export default ContactUs;
