/**
 * @fileoverview ContactUs component that provides a contact form with animated elements
 * using Framer Motion and various UI components. The component renders a contact form
 * with a gradient background overlay and animated form elements.
 */

import React from 'react';
import { motion } from 'framer-motion';

const MotionH2 = motion.h2;
const MotionDiv = motion.div;
const MotionButton = motion.button;
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSendEmailMutation } from '../services/api';
import { errorToast, successToast } from '@/utils/toast';

/**
 * Animation variants for the form container element
 * Controls the initial animation and staggered children animations
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0 and y offset
 * @property {Object} visible - Final state with opacity 1 and y at 0
 */
const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1,
    },
  },
};

/**
 * Animation variants for individual form items
 * Controls the slide-in animation for form fields
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0 and x offset
 * @property {Object} visible - Final state with opacity 1 and x at 0
 */
const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

/**
 * ContactUs Component
 *
 * A React component that renders a contact form section with animated elements and a gradient background.
 * The form includes fields for name, email, and message with hover animations.
 *
 * Features:
 * - Animated form elements using Framer Motion
 * - Gradient background with overlay
 * - Responsive design using Tailwind CSS
 * - Interactive hover effects on form elements
 * - Form fields for name, email, and message
 * - Animated submit button with hover and tap effects
 *
 * Structure:
 * - Section container with gradient background
 * - Heading with fade-in animation
 * - Form container with glass-morphism effect
 * - Animated form fields with hover effects
 * - Submit button with interactive animations
 *
 * @component
 * @returns {JSX.Element} Rendered contact form section
 *
 * @example
 * ```jsx
 * // Basic usage
 * <ContactUs />
 * ```
 *
 * @example
 * ```jsx
 * // With custom styling
 * <div className="custom-container">
 *   <ContactUs />
 * </div>
 * ```
 */
const ContactUs = () => {
  const [userName, setUserName] = React.useState('');
  const [userEmail, setUserEmail] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [sendContactUsFormEmailTrigger, { isLoading }] = useSendEmailMutation();

  /**
   * Handles the click event on the send message button
   * Queries the API to send the content to the provided email address
   * Displays a success or error toast notification based on the API response
   * @function
   */
  const handleSendMessageClick = () => {
    sendContactUsFormEmailTrigger({
      userName: userName,
      userEmail: userEmail,
      message: message,
    })
      .unwrap()
      .then(() => {
        successToast('Contact us form successfully sent!');
        setUserName('');
        setUserEmail('');
        setMessage('');
      })
      .catch((error) => {
        console.error(error);
        errorToast('Unable to send the contact us form. Please try again later.');
      });
  };

  return (
    <section
      id="contact-us"
      className="py-14 px-4 sm:px-6 md:px-8 min-h-[41.75rem] bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(temp_image_3.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(255, 255, 255, .7) 0%, rgba(255, 255, 255, .8) 20%, rgba(255, 255, 255, 1) 40%, rgba(255, 255, 255, 1) 60%, rgba(255, 255, 255, 0.8) 80%, rgba(255, 255, 255, 0.7) 100%)',
        }}
      />

      <div className="mx-auto max-w-6xl relative z-10">
        <MotionH2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#324755] mb-12 text-center"
        >
          Contact Us
        </MotionH2>
        <MotionDiv
          variants={formVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ amount: 0.3 }}
          className="mx-auto rounded-lg border border-[#324755]/20 bg-white p-8 max-w-md relative"
          style={{
            boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.10), 0px 2px 4px -2px rgba(0, 0, 0, 0.10)',
          }}
        >
          {/* SVG decoration - bottom layer */}
          <div className="absolute -bottom-[10px] -left-[10px] w-full h-full z-0">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill="none"
                stroke="#87BCBF"
                strokeWidth=".75"
                rx="3"
              />
            </svg>
          </div>

          {/* White background - middle layer */}
          <div className="absolute inset-0 bg-white rounded-lg border border-[#324755]/20 z-10" />

          {/* Form content - top layer */}
          <div className="relative z-20">
            <MotionDiv
              variants={itemVariants}
              className="grid w-full max-w-sm items-center gap-1.5 mb-6"
            >
              <Label htmlFor="name" className="text-[#324755]">
                Name
              </Label>
              <MotionDiv whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
                <Input
                  type="text"
                  id="name"
                  placeholder="Name"
                  className="bg-white h-11"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </MotionDiv>
            </MotionDiv>
            <MotionDiv
              variants={itemVariants}
              className="grid w-full max-w-sm items-center gap-1.5 mb-6"
            >
              <Label htmlFor="email" className="text-[#324755]">
                Email
              </Label>
              <MotionDiv whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
                <Input
                  type="email"
                  id="email"
                  placeholder="Email"
                  className="bg-white h-11"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </MotionDiv>
            </MotionDiv>
            <MotionDiv variants={itemVariants} className="grid w-full gap-1.5 mb-6">
              <Label htmlFor="message" className="text-[#324755]">
                Message
              </Label>
              <MotionDiv whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
                <Textarea
                  placeholder="Write message..."
                  id="message"
                  className="bg-white h-28"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </MotionDiv>
            </MotionDiv>
            <MotionDiv variants={itemVariants}>
              <MotionButton
                onClick={handleSendMessageClick}
                disabled={isLoading}
                whileHover={
                  !isLoading
                    ? {
                        scale: 1.05,
                        backgroundColor: '#4A6B7A',
                        transition: { duration: 0.2 },
                      }
                    : {}
                }
                whileTap={!isLoading ? { scale: 0.95 } : {}}
                transition={!isLoading ? { type: 'spring', stiffness: 400, damping: 10 } : {}}
                className={`w-full px-6 py-2 rounded-lg font-bold ${
                  isLoading ? 'bg-[#506570] cursor-not-allowed' : 'bg-[#324755] cursor-pointer'
                } text-white ${!isLoading ? 'hover:shadow-lg hover:shadow-[#87BCBF]/20' : ''}`}
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </MotionButton>
            </MotionDiv>
          </div>
        </MotionDiv>
      </div>
    </section>
  );
};

export default ContactUs;
