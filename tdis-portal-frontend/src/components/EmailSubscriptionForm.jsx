/**
 * @fileoverview EmailSubscriptionForm component that provides an email subscription form
 * with animated elements using Framer Motion. The component renders a subscription section
 * with a call-to-action for users to sign up for TDIS updates.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;
const MotionH2 = motion.h2;
const MotionButton = motion.button;
import { Input } from '@/components/ui/input';
import { useSubscribeUserMutation } from '../services/api';
import { errorToast, successToast } from '@/utils/toast';

/**
 * Email validation without regex to avoid ReDoS (S5852).
 * Validates: one @, non-empty local part (no spaces), domain with at least one dot and TLD.
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const s = email.trim();
  if (s.length === 0 || s.length > 254) return false;
  const atIndex = s.indexOf('@');
  if (atIndex <= 0 || atIndex !== s.lastIndexOf('@')) return false;
  const local = s.slice(0, atIndex);
  const domain = s.slice(atIndex + 1);
  if (local.includes(' ') || domain.length === 0) return false;
  const dotIndex = domain.lastIndexOf('.');
  return dotIndex > 0 && dotIndex !== domain.length - 1;
};

/**
 * Animation variants for the container element
 * Controls the initial fade-in and staggered children animations
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0
 * @property {Object} visible - Final state with opacity 1 and staggered children animation
 * @property {Object} visible.transition - Animation timing configuration
 * @property {number} visible.transition.duration - Animation duration in seconds
 * @property {number} visible.transition.staggerChildren - Delay between child animations
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.2,
    },
  },
};

/**
 * Animation variants for child elements
 * Controls the slide-up animation for individual elements
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0 and y offset
 * @property {Object} visible - Final state with opacity 1 and y at 0
 */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/**
 * EmailSubscriptionForm Component
 *
 * A React component that renders an email subscription form section with animated elements.
 * The form provides a way for users to subscribe to TDIS updates and activities.
 *
 * Features:
 * - Animated container and child elements using Framer Motion
 * - Responsive design using Tailwind CSS
 * - Interactive hover effects on input and button
 * - Email input field with validation
 * - Animated subscribe button with hover and tap effects
 * - Clean, modern UI with consistent branding
 * - Form submission handling with API integration
 * - Email validation with error handling
 * - Success/error toast notifications
 * - Loading states for submission
 *
 * Structure:
 * - Section container with brand background color
 * - Animated heading with call-to-action
 * - Descriptive text
 * - Email input field with hover animation and validation
 * - Subscribe button with interactive animations and loading state
 *
 * @component
 * @returns {JSX.Element} Rendered email subscription form section
 *
 * @example
 * ```jsx
 * // Basic usage
 * <EmailSubscriptionForm />
 * ```
 *
 * @example
 * ```jsx
 * // With custom container
 * <div className="custom-wrapper">
 *   <EmailSubscriptionForm />
 * </div>
 * ```
 */
const EmailSubscriptionForm = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [subscribeUserTrigger, { isLoading }] = useSubscribeUserMutation();

  /**
   * Validates the email input and updates error state
   * @param {string} emailValue - The email value to validate
   * @returns {boolean} - Whether the email is valid
   */
  const validateEmail = (emailValue) => {
    if (!emailValue.trim()) {
      setEmailError('Email is required');
      return false;
    } else if (!isValidEmail(emailValue)) {
      setEmailError('Please enter a valid email address');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  /**
   * Handles email input change with validation
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event
   */
  const handleEmailChange = (e) => {
    const emailValue = e.target.value;
    setEmail(emailValue);

    // Clear error when user starts typing
    if (emailError) {
      validateEmail(emailValue);
    }
  };

  /**
   * Handles the click event on the subscribe button
   * Validates the email and sends subscription request to the API
   * Displays a success or error toast notification based on the API response
   * @function
   */
  const handleSubscribeClick = () => {
    // Validate email before submission
    if (!validateEmail(email)) {
      return;
    }

    // Send subscription request to the API
    subscribeUserTrigger({
      emailAddress: email,
    })
      .unwrap()
      .then(() => {
        successToast('Successfully subscribed to TDIS updates!');
        setEmail('');
        setEmailError('');
      })
      .catch((error) => {
        console.error('Subscription error:', error);
        errorToast('Unable to subscribe. Please try again later.');
      });
  };

  /**
   * Handles form submission on Enter key press
   * @param {React.KeyboardEvent<HTMLInputElement>} e - The keyboard event
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubscribeClick();
    }
  };

  return (
    <section
      id="what-we-do"
      className="py-14 px-4 sm:px-6 md:px-8 bg-[#324755] min-h-[23.5rem] border-b border-b-[#E5E7EB]"
    >
      <MotionDiv
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ amount: 0.3 }}
        className="mx-auto max-w-6xl"
      >
        <MotionH2
          variants={itemVariants}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#FFFFFF] mb-12 text-center"
        >
          Want to stay aware of TDIS activities?
        </MotionH2>
        <motion.p variants={itemVariants} className="text-white text-center text-xl mb-8">
          Sign up for our email list to receive important updates.
        </motion.p>
        <MotionDiv
          variants={itemVariants}
          className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto w-full"
        >
          <MotionDiv whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} className="w-full">
            <Input
              type="email"
              placeholder="Enter your email"
              className={`w-full bg-white h-12 ${emailError ? 'border-red-500 focus:border-red-500' : ''}`}
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
          </MotionDiv>
          <MotionButton
            onClick={handleSubscribeClick}
            disabled={isLoading}
            whileHover={{
              scale: 1.05,
              backgroundColor: '#FCD34D',
              transition: { duration: 0.2 },
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            className={`w-full sm:w-auto font-bold px-6 py-3 rounded-md ${
              isLoading
                ? 'bg-[#6B7280] text-white cursor-not-allowed'
                : 'bg-[#EAB308] text-[#111827] cursor-pointer hover:shadow-lg hover:shadow-[#EAB308]/20'
            }`}
          >
            {isLoading ? 'Subscribing...' : 'Subscribe'}
          </MotionButton>
        </MotionDiv>
        {/* Error message container below the form */}
        {emailError && (
          <MotionDiv
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-left w-full max-w-md mx-auto"
          >
            <p className="text-red-300 text-sm">{emailError}</p>
          </MotionDiv>
        )}
      </MotionDiv>
    </section>
  );
};

export default EmailSubscriptionForm;
