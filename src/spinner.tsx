import styles from "./spinner.module.css";

export const Spinner = ({ style }) => {
  return (
    <div style={style} className={styles["lds-ripple"]}>
      <div></div>
      <div></div>
    </div>
  );
};
