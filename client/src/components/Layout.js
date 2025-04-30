import React from 'react';
import MainNavbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <>
      <MainNavbar />
      <main>{children}</main>
    </>
  );
};

export default Layout;
