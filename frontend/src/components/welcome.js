import React from 'react';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

const WelcomePage = () => {
  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Skyforge</h1>
        <p style={styles.paragraph}>Get started by creating an account or logging in.</p>
        <Link to="/auth/register" className="btn btn-primary" style={styles.button}>
          Register
        </Link>
        <Link to="/auth/login" className="btn btn-secondary" style={styles.button}>
          Login
        </Link>
      </div>
    </div>
  );
};

const styles = {
  body: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    margin: 0,
    fontFamily: 'Arial, sans-serif',
    backgroundImage: 'url(/logo/background.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
  },
  container: {
    textAlign: 'center',
    background: '#ffffff',
    padding: '3rem',
    borderRadius: '15px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    maxWidth: '400px',
    width: '100%',
  },
  heading: {
    color: '#007bff',
    fontSize: '2rem',
    marginBottom: '1.5rem',
  },
  paragraph: {
    color: '#495057',
    marginBottom: '2rem',
    fontSize: '1.1rem',
  },
  button: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    fontSize: '1.2rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    transition: 'all 0.3s ease-in-out',
  },
};

export default WelcomePage;

// import React from 'react';
// import { Link } from 'react-router-dom';
// import 'bootstrap/dist/css/bootstrap.min.css';

// const WelcomePage = () => {
//   return (
//     <div style={styles.body}>
//       {/* Header Navigation */}
//       <header style={styles.header}>
//         <div style={styles.navContainer}>
//           <div style={styles.logo}>
//             {/* <img src="/logo/logo.png" alt="Skyforge Logo" height="40" /> */}
//             <span style={styles.logoText}>Skyforge</span>
//           </div>
//           <nav style={styles.nav}>
//             <Link to="/" style={styles.navLink}>Home</Link>
//             <Link to="/features" style={styles.navLink}>Features</Link>
//             <Link to="/pricing" style={styles.navLink}>Pricing</Link>
//             <Link to="/about" style={styles.navLink}>About</Link>
//             <Link to="/contact" style={styles.navLink}>Contact</Link>
//           </nav>
//         </div>
//       </header>

//       {/* Hero Section */}
//       <section style={styles.hero}>
//         <div style={styles.heroContent}>
//           <h1 style={styles.heroHeading}>Empower Your Digital Presence</h1>
//           <p style={styles.heroText}>Fast, secure and reliable solutions for every business need. Join thousands of satisfied customers today.</p>
//           <div style={styles.buttonGroup}>
//             <Link to="/api/auth/register" className="btn btn-primary" style={styles.primaryButton}>
//               Get Started - It's Free
//             </Link>
//             <Link to="/auth/login" className="btn btn-secondary" style={styles.secondaryButton}>
//               Login to Account
//             </Link>
//           </div>
//         </div>
//       </section>

//       {/* Features Section */}
//       <section style={styles.features}>
//         <div style={styles.container}>
//           <h2 style={styles.sectionHeading}>Everything You Need to Succeed</h2>
//           <p style={styles.sectionSubheading}>Tailored solutions for every need, whether you're a blogger, developer, or business owner.</p>
          
//           <div style={styles.featuresGrid}>
//             <div style={styles.featureCard}>
//               <div style={styles.featureIcon}>📝</div>
//               <h3 style={styles.featureTitle}>For Bloggers</h3>
//               <p style={styles.featureText}>Empower your blogging journey with easy management and SEO tools.</p>
//             </div>
            
//             <div style={styles.featureCard}>
//               <div style={styles.featureIcon}>💻</div>
//               <h3 style={styles.featureTitle}>For Developers</h3>
//               <p style={styles.featureText}>Streamline your workflow with powerful development tools and staging environments.</p>
//             </div>
            
//             <div style={styles.featureCard}>
//               <div style={styles.featureIcon}>🏢</div>
//               <h3 style={styles.featureTitle}>For Businesses</h3>
//               <p style={styles.featureText}>We make going digital simple, so your business can focus on what matters most.</p>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* Stats Section */}
//       <section style={styles.stats}>
//         <div style={styles.container}>
//           <div style={styles.statsGrid}>
//             <div style={styles.statItem}>
//               <h3 style={styles.statNumber}>15k+</h3>
//               <p style={styles.statLabel}>Clients Served</p>
//             </div>
//             <div style={styles.statItem}>
//               <h3 style={styles.statNumber}>10k+</h3>
//               <p style={styles.statLabel}>Websites Hosted</p>
//             </div>
//             <div style={styles.statItem}>
//               <h3 style={styles.statNumber}>24/7</h3>
//               <p style={styles.statLabel}>Expert Support</p>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* CTA Section */}
//       <section style={styles.cta}>
//         <div style={styles.container}>
//           <h2 style={styles.ctaHeading}>Ready to Get Started?</h2>
//           <p style={styles.ctaText}>Create an account or login to access your dashboard and start building your digital presence today.</p>
//           <div style={styles.buttonGroup}>
//             <Link to="/api/auth/register" className="btn btn-primary" style={styles.primaryButton}>
//               Register Now
//             </Link>
//             <Link to="/auth/login" className="btn btn-secondary" style={styles.secondaryButton}>
//               Login
//             </Link>
//           </div>
//         </div>
//       </section>

//       {/* Footer */}
//       <footer style={styles.footer}>
//         <div style={styles.container}>
//           <p style={styles.footerText}>© {new Date().getFullYear()} Skyforge. All rights reserved.</p>
//         </div>
//       </footer>
//     </div>
//   );
// };

// const styles = {
//   body: {
//     margin: 0,
//     fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
//     backgroundImage: 'url(/logo/background.png)',
//     backgroundSize: 'cover',
//     backgroundPosition: 'center',
//     backgroundRepeat: 'no-repeat',
//     backgroundAttachment: 'fixed',
//     color: '#2d3748',
//     lineHeight: 1.6,
//   },
//   header: {
//     backgroundColor: 'rgba(255, 255, 255, 0.95)',
//     boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
//     padding: '1rem 0',
//     position: 'sticky',
//     top: 0,
//     zIndex: 100,
//   },
//   navContainer: {
//     display: 'flex',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     maxWidth: '1200px',
//     margin: '0 auto',
//     padding: '0 2rem',
//   },
//   logo: {
//     display: 'flex',
//     alignItems: 'center',
//     fontWeight: 'bold',
//     fontSize: '1.5rem',
//   },
//   logoText: {
//     marginLeft: '0.5rem',
//     color: '#007bff',
//   },
//   nav: {
//     display: 'flex',
//     gap: '2rem',
//   },
//   navLink: {
//     color: '#4a5568',
//     textDecoration: 'none',
//     fontWeight: '500',
//     transition: 'color 0.3s',
//   },
//   hero: {
//     padding: '6rem 2rem',
//     textAlign: 'center',
//     background: 'linear-gradient(135deg, rgba(0,123,255,0.8) 0%, rgba(101,78,163,0.8) 100%)',
//     color: 'white',
//   },
//   heroContent: {
//     maxWidth: '800px',
//     margin: '0 auto',
//   },
//   heroHeading: {
//     fontSize: '3rem',
//     fontWeight: '700',
//     marginBottom: '1.5rem',
//   },
//   heroText: {
//     fontSize: '1.25rem',
//     marginBottom: '2.5rem',
//     opacity: 0.9,
//   },
//   buttonGroup: {
//     display: 'flex',
//     gap: '1rem',
//     justifyContent: 'center',
//     flexWrap: 'wrap',
//   },
//   primaryButton: {
//     backgroundColor: '#007bff',
//     border: 'none',
//     borderRadius: '50px',
//     padding: '0.75rem 2rem',
//     fontWeight: '600',
//     fontSize: '1.1rem',
//     transition: 'all 0.3s',
//     textDecoration: 'none',
//     color: 'white',
//     display: 'inline-block',
//   },
//   secondaryButton: {
//     backgroundColor: 'transparent',
//     border: '2px solid white',
//     borderRadius: '50px',
//     padding: '0.75rem 2rem',
//     fontWeight: '600',
//     fontSize: '1.1rem',
//     transition: 'all 0.3s',
//     textDecoration: 'none',
//     color: 'white',
//     display: 'inline-block',
//   },
//   features: {
//     padding: '5rem 2rem',
//     backgroundColor: '#f8f9fa',
//   },
//   container: {
//     maxWidth: '1200px',
//     margin: '0 auto',
//     padding: '0 2rem',
//   },
//   sectionHeading: {
//     textAlign: 'center',
//     fontSize: '2.5rem',
//     fontWeight: '700',
//     marginBottom: '1rem',
//     color: '#2d3748',
//   },
//   sectionSubheading: {
//     textAlign: 'center',
//     fontSize: '1.2rem',
//     marginBottom: '3rem',
//     color: '#718096',
//     maxWidth: '800px',
//     marginLeft: 'auto',
//     marginRight: 'auto',
//   },
//   featuresGrid: {
//     display: 'grid',
//     gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
//     gap: '2rem',
//   },
//   featureCard: {
//     backgroundColor: 'white',
//     borderRadius: '12px',
//     padding: '2rem',
//     textAlign: 'center',
//     boxShadow: '0 5px 15px rgba(0, 0, 0, 0.05)',
//     transition: 'transform 0.3s, box-shadow 0.3s',
//   },
//   featureIcon: {
//     fontSize: '3rem',
//     marginBottom: '1.5rem',
//   },
//   featureTitle: {
//     fontSize: '1.5rem',
//     fontWeight: '600',
//     marginBottom: '1rem',
//     color: '#2d3748',
//   },
//   featureText: {
//     color: '#718096',
//     lineHeight: 1.6,
//   },
//   stats: {
//     padding: '4rem 2rem',
//     backgroundColor: 'white',
//   },
//   statsGrid: {
//     display: 'grid',
//     gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
//     gap: '2rem',
//     textAlign: 'center',
//   },
//   statItem: {
//     padding: '1.5rem',
//   },
//   statNumber: {
//     fontSize: '2.5rem',
//     fontWeight: '700',
//     color: '#007bff',
//     marginBottom: '0.5rem',
//   },
//   statLabel: {
//     color: '#718096',
//     fontWeight: '500',
//   },
//   cta: {
//     padding: '5rem 2rem',
//     backgroundColor: '#f8f9fa',
//     textAlign: 'center',
//   },
//   ctaHeading: {
//     fontSize: '2.5rem',
//     fontWeight: '700',
//     marginBottom: '1rem',
//     color: '#2d3748',
//   },
//   ctaText: {
//     fontSize: '1.2rem',
//     marginBottom: '2.5rem',
//     color: '#718096',
//     maxWidth: '800px',
//     marginLeft: 'auto',
//     marginRight: 'auto',
//   },
//   footer: {
//     backgroundColor: '#2d3748',
//     color: 'white',
//     padding: '2rem',
//     textAlign: 'center',
//   },
//   footerText: {
//     margin: 0,
//     opacity: 0.8,
//   },
// };

// // Add hover effects
// const addHoverEffects = () => {
//   const navLink = document.querySelectorAll('[style*="navLink"]');
//   const primaryButton = document.querySelectorAll('[style*="primaryButton"]');
//   const secondaryButton = document.querySelectorAll('[style*="secondaryButton"]');
//   const featureCard = document.querySelectorAll('[style*="featureCard"]');
  
//   // Add event listeners for hover effects
//   if (navLink.length) {
//     navLink.forEach(link => {
//       link.addEventListener('mouseenter', () => {
//         link.style.color = '#007bff';
//       });
//       link.addEventListener('mouseleave', () => {
//         link.style.color = '#4a5568';
//       });
//     });
//   }
  
//   if (primaryButton.length) {
//     primaryButton.forEach(button => {
//       button.addEventListener('mouseenter', () => {
//         button.style.backgroundColor = '#0056b3';
//         button.style.transform = 'translateY(-2px)';
//       });
//       button.addEventListener('mouseleave', () => {
//         button.style.backgroundColor = '#007bff';
//         button.style.transform = 'translateY(0)';
//       });
//     });
//   }
  
//   if (secondaryButton.length) {
//     secondaryButton.forEach(button => {
//       button.addEventListener('mouseenter', () => {
//         button.style.backgroundColor = 'white';
//         button.style.color = '#007bff';
//         button.style.transform = 'translateY(-2px)';
//       });
//       button.addEventListener('mouseleave', () => {
//         button.style.backgroundColor = 'transparent';
//         button.style.color = 'white';
//         button.style.transform = 'translateY(0)';
//       });
//     });
//   }
  
//   if (featureCard.length) {
//     featureCard.forEach(card => {
//       card.addEventListener('mouseenter', () => {
//         card.style.transform = 'translateY(-5px)';
//         card.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
//       });
//       card.addEventListener('mouseleave', () => {
//         card.style.transform = 'translateY(0)';
//         card.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.05)';
//       });
//     });
//   }
// };

// // Initialize hover effects after component mounts
// setTimeout(addHoverEffects, 100);

// export default WelcomePage;