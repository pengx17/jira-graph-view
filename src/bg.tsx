import styles from "./bg.module.css";

const FWIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 60"
      className={styles.fwIcon}
    >
      <path d="M73.42 6.35A23.68 23.68 0 0 0 50 26.38a23.68 23.68 0 1 0-6.61 20.32L38.64 42A16.95 16.95 0 0 1 10 33.29h80A17 17 0 0 1 73.35 47a16.74 16.74 0 0 1-12-5l-4.74 4.7A23.65 23.65 0 1 0 73.42 6.35zM10 26.6a17 17 0 0 1 33.25 0zm46.74 0a17 17 0 0 1 33.26 0z"></path>
    </svg>
  );
};

export const BG = () => {
  return (
    <div className={styles.root}>
      <FWIcon />
    </div>
  );
};
