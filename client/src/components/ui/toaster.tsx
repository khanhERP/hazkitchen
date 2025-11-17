import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useTranslation } from "@/lib/i18n"

export function Toaster() {
  const { toasts } = useToast()
  const { t } = useTranslation()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Handle translation for title
        let translatedTitle = title;
        if (title && typeof title === 'string') {
          // Check if it's a translation key (contains dot notation)
          if (title.includes('.') && !title.includes(' ')) {
            try {
              const translated = t(title as any);
              // Only use translation if it's different from the key
              if (translated && translated !== title) {
                translatedTitle = translated;
              }
            } catch (error) {
              console.error(`Translation error for title key: ${title}`, error);
            }
          }
          // Replace product update title with generic "Success"
          else if (title.includes('đã được cập nhật')) {
            translatedTitle = t('common.success');
          }
        }

        // Handle translation for description with better error formatting
        let translatedDescription = description;
        if (description) {
          if (typeof description === 'string') {
            // Filter out quantity change notifications (e.g., "Tăng số lượng ... từ ... lên ...")
            if (description.includes('Tăng số lượng') || description.includes('Giảm số lượng')) {
              // Skip this toast by setting description to null
              translatedDescription = null;
            }
            // Check if it's a translation key (contains dot notation like "settings.productCreatedSuccess")
            else if (description.includes('.') && !description.includes(' ')) {
              // It's a translation key (no spaces, has dots)
              try {
                const translated = t(description as any);
                // Only use translation if it's different from the key (meaning translation was found)
                if (translated && translated !== description) {
                  translatedDescription = translated;
                } else {
                  // Fallback: try to provide a meaningful message
                  console.warn(`Missing translation for key: ${description}`);
                  translatedDescription = description.split('.').pop() || description;
                }
              } catch (error) {
                console.error(`Translation error for key: ${description}`, error);
                translatedDescription = description;
              }
            }
            // Handle "Failed to create product" errors with more context
            else if (description.includes('Failed to create product')) {
              translatedDescription = 'Không thể tạo sản phẩm. Vui lòng kiểm tra lại thông tin và thử lại.';
            }
            // Remove product name from update success messages
            else if (description.includes('đã được cập nhật')) {
              translatedDescription = t('common.productUpdateSuccessDesc');
            }
          }
        }
        
        // Skip rendering this toast if description was filtered out
        if (translatedDescription === null) {
          return null;
        }

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-2">
              {translatedTitle && translatedTitle !== null && (
                <ToastTitle className="text-sm font-semibold">
                  {translatedTitle}
                </ToastTitle>
              )}
              {translatedDescription && (
                <ToastDescription className="text-sm opacity-90 mt-1">
                  {translatedDescription}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
