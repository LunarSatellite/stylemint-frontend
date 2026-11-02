/** Full-page navigations out of the SPA (eSewa, Chrome intent). One seam so tests can watch them. */
export const nav = {
  assign(url: string) {
    window.location.assign(url);
  },
};
