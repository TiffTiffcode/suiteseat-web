
//src\app\[slug]\CourseClient.tsx
"use client";

import "./styles/CoursePage/basic.css";
import BasicCourseTemplate from "./CourseTemplates/basic/Template";

export default function CourseClient({ course }: { course: any }) {
  return <BasicCourseTemplate course={course} />;
}
