import type { enSessionTemplates } from "./session-templates.en";

/** Vietnamese text for the lesson-plan template picker in the session form; must define every key of `enSessionTemplates`. */
export const viSessionTemplates = {
    "sessionTemplates.title": "Mẫu giáo án",
    "sessionTemplates.description": "Bắt đầu từ một buổi tập có sẵn. Bạn vẫn sửa được mọi trường.",
    "sessionTemplates.groupLabel": "Mẫu giáo án",
    "sessionTemplates.category.TECHNIQUE": "Kỹ thuật",
    "sessionTemplates.category.SPARRING": "Đối kháng",
    "sessionTemplates.category.CONDITIONING": "Thể lực",
    "sessionTemplates.category.TACTICS": "Chiến thuật",
    "sessionTemplates.restricted": "Có hạn chế",
    "sessionTemplates.duration": "{n} phút",
    "sessionTemplates.why": "Vì sao cân nhắc bài này?",
    "sessionTemplates.steps": "Các bước",
    "sessionTemplates.filled": "Tiêu đề, loại buổi, thời lượng và ghi chú bên dưới đã được điền từ mẫu này. Sửa lại nếu cần.",
    "sessionTemplates.clear": "Bỏ mẫu",
    "sessionTemplates.disclaimer": "Mẫu chỉ minh họa cấu trúc buổi tập. Nội dung và liều lượng cần HLV chuyên môn thẩm định.",
} satisfies Record<keyof typeof enSessionTemplates, string>;
