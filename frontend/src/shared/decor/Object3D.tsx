import availableImages from "virtual:objects-3d";
import { objectFallbacks, type ObjectName } from "./objectFallbacks";
import styles from "./Object3D.module.css";

type Object3DProps = {
  name: ObjectName;
  className?: string;
  eager?: boolean;
};

export function Object3D({ name, className, eager = false }: Object3DProps) {
  const classes = [styles.object, className].filter(Boolean).join(" ");
  if (availableImages.includes(name)) {
    return (
      <img
        className={classes}
        src={`/3d/${name}.webp`}
        alt=""
        aria-hidden="true"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  const Fallback = objectFallbacks[name];
  return (
    <div className={classes} aria-hidden="true">
      <Fallback />
    </div>
  );
}
