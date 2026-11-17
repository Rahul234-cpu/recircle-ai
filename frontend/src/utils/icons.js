import {
  Bike, BookOpen, Box, Cable, CookingPot, Cpu, CupSoda, Cylinder, Laptop, Newspaper, Package, Recycle, Refrigerator,
  Shirt, Smartphone, Sofa, Tv, Wine, Wrench,
} from 'lucide-react';

// Named icons admins can pick for categories (kept small to avoid bundling every icon).
export const ICONS = {
  Bike, BookOpen, Box, Cable, CookingPot, Cpu, CupSoda, Cylinder, Laptop, Newspaper, Package, Recycle, Refrigerator, Shirt, Smartphone, Sofa, Tv, Wine, Wrench,
};

export const iconFor = (name, fallback = Recycle) => ICONS[name] || fallback;
