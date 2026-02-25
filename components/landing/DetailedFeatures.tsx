import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function DetailedFeatures() {
  const t = useTranslations("HomePage");

  return (
    <div className=" mx-auto px-8 pt-8 mt-20 relative bg-secondary">
      <div className="max-w-[1440px] mx-auto">
        <h2 className="text-5xl font-heading text-center font-bold mb-14">
          {t("featuresTitle")}
        </h2>
        <div className="flex flex-col md:flex-row justify-center gap-8 mt-10 items-end">
          <div className="">
            <div>
              <Image
                src="/assets/dovanorius-thinking.png"
                alt="mock"
                width={500}
                height={500}
              />
            </div>
          </div>
          <div className="max-w-xl">
            <div className="mb-8">
              <h3 className="font-heading text-4xl font-semibold mb-4">
                {t("featureOneTitle")}{" "}
                <span className="badge badge-neutral badge-outline badge-md">
                  {t("soon")}
                </span>
              </h3>
              <p className="font-body text-accent-content">
                {t("featureOneDescription")}
              </p>
            </div>
            <div className="mb-8">
              <h3 className="font-heading text-4xl font-semibold mb-4">
                {t("featureTwoTitle")}
              </h3>
              <p className="font-body">{t("featureTwoDescription")}</p>
            </div>
            <div className="mb-8">
              <h3 className="font-heading text-4xl font-semibold mb-4">
                {t("featureThreeTitle")}
              </h3>
              <p className="font-body">{t("featureThreeDescription")}</p>

              <Link
                href="/dashboard"
                className="btn btn-primary font-heading btn-md md:btn-lg mt-8"
              >
                {t("ctaStartBuilding")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
