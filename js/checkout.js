// Checkout page functionality
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('checkout.html')) {
        initializeCheckoutPage();
    }
});

async function initializeCheckoutPage() {
    // Load checkout items
    await loadCheckoutItems();
    
    // Initialize checkout form
    initializeCheckoutForm();
    
    // Check if cart is empty
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        document.querySelector('.checkout-content').innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>Your cart is empty</h3>
                <p>Add some products before checkout!</p>
                <a href="shop.html" class="btn btn-primary" style="margin-top: 1rem;">Shop Now</a>
            </div>
        `;
    }
}

async function loadCheckoutItems() {
    const checkoutItems = document.getElementById('checkout-items');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutTotal = document.getElementById('checkout-total');
    
    if (!checkoutItems) return;
    
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        if (cart.length === 0) {
            checkoutItems.innerHTML = '<p>No items in cart</p>';
            checkoutSubtotal.textContent = 'R0.00';
            checkoutTotal.textContent = 'R0.00';
            return;
        }
        
        // Load product details for cart items
        const products = await Promise.all(
            cart.map(async (item) => {
                try {
                    const product = await apiRequest(`/api/products/${item.productId}`);
                    return { ...item, ...product };
                } catch (error) {
                    console.error(`Failed to load product ${item.productId}:`, error);
                    return null;
                }
            })
        );
        
        // Filter out failed products
        const validProducts = products.filter(product => product !== null);
        
        // Display checkout items
        checkoutItems.innerHTML = validProducts.map(product => `
            <div class="checkout-item">
                <div>
                    <div style="font-weight: bold;">${product.name}</div>
                    <div style="color: var(--gray-color); font-size: 0.9rem;">Size: ${product.size}</div>
                    <div style="color: var(--gray-color); font-size: 0.9rem;">Qty: ${product.quantity}</div>
                </div>
                <div style="font-weight: bold;">R${(product.price * product.quantity).toFixed(2)}</div>
            </div>
        `).join('');
        
        // Calculate totals
        const subtotal = validProducts.reduce((sum, product) => sum + (product.price * product.quantity), 0);
        
        checkoutSubtotal.textContent = `R${subtotal.toFixed(2)}`;
        checkoutTotal.textContent = `R${subtotal.toFixed(2)}`;
        
        // Store items for form submission
        window.checkoutItems = validProducts;
        
    } catch (error) {
        console.error('Failed to load checkout items:', error);
        checkoutItems.innerHTML = '<div class="message error">Failed to load items. Please try again.</div>';
    }
}

function initializeCheckoutForm() {
    const form = document.getElementById('checkout-form');
    
    if (!form) return;
    
    form.addEventListener('submit', handleCheckoutSubmission);
}

async function handleCheckoutSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const customerName = formData.get('customerName');
    const customerEmail = formData.get('customerEmail');
    const customerPhone = formData.get('customerPhone');
    const customerAddress = formData.get('customerAddress');
    const paymentMethod = formData.get('paymentMethod');
    
    // Validate form
    if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
        alert('Please fill in all required fields.');
        return;
    }
    
    // Get cart items and total
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }
    
    const total = await getCartTotal();
    
    try {
        // Create order data
        const orderData = {
            customerName,
            customerEmail,
            customerAddress: `${customerAddress}\nPhone: ${customerPhone}`,
            items: window.checkoutItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                size: item.size,
                price: item.price
            })),
            totalAmount: total
        };
        
        if (paymentMethod === 'whatsapp') {
            // Handle WhatsApp order
            handleWhatsAppOrder(orderData, customerName, customerPhone);
        } else {
            // Handle other payment methods (demo)
            await handleOtherPayments(orderData);
        }
        
    } catch (error) {
        console.error('Checkout failed:', error);
        alert('Checkout failed. Please try again.');
    }
}

function handleWhatsAppOrder(orderData, customerName, customerPhone) {
    // Create WhatsApp message
    const itemsList = orderData.items.map(item => 
        `- ${item.name || 'Product'} (Size: ${item.size}) x${item.quantity} - R${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');
    
    const message = `
🛍️ NEW ORDER from R Colly(RC) Fashion

Customer: ${customerName}
Email: ${orderData.customerEmail}
Phone: ${customerPhone}

ITEMS:
${itemsList}

TOTAL: R${orderData.totalAmount.toFixed(2)}

DELIVERY ADDRESS:
${orderData.customerAddress}

Please confirm this order and provide payment instructions.
    `.trim();
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/+27793757047?text=${encodedMessage}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    // Clear cart and redirect
    setTimeout(() => {
        clearCart();
        showOrderConfirmation('whatsapp');
    }, 1000);
}

async function handleOtherPayments(orderData) {
    try {
        // Save order to database
        const response = await apiRequest('/api/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        if (response.orderId) {
            clearCart();
            showOrderConfirmation('database', response.orderId);
        } else {
            throw new Error('Failed to create order');
        }
        
    } catch (error) {
        console.error('Failed to save order:', error);
        alert('Failed to process order. Please try again or contact us directly.');
    }
}

function showOrderConfirmation(method, orderId = null) {
    const container = document.querySelector('.checkout-content');
    
    let confirmationHTML = `
        <div class="order-confirmation" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h2 style="color: var(--success-color); margin-bottom: 2rem;">✅ Order Confirmed!</h2>
    `;
    
    if (method === 'whatsapp') {
        confirmationHTML += `
            <p style="margin-bottom: 2rem; font-size: 1.1rem;">Your order has been sent via WhatsApp. We'll contact you soon with payment instructions and delivery details.</p>
            <div style="background: var(--light-gray); padding: 2rem; border-radius: 10px; margin-bottom: 2rem;">
                <h4>What happens next?</h4>
                <ol style="text-align: left; max-width: 400px; margin: 1rem auto;">
                    <li>We'll confirm your order via WhatsApp</li>
                    <li>Send payment instructions</li>
                    <li>Process and ship your order</li>
                    <li>Provide tracking information</li>
                </ol>
            </div>
        `;
    } else if (orderId) {
        confirmationHTML += `
            <p style="margin-bottom: 2rem; font-size: 1.1rem;">Your order #${orderId} has been received and is being processed.</p>
            <p style="margin-bottom: 2rem;">We'll send you an email confirmation shortly.</p>
        `;
    }
    
    confirmationHTML += `
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
                <a href="index.html" class="btn btn-secondary">Back to Home</a>
                <a href="https://wa.me/+27793757047?text=Hi%20I'd%20like%20to%20track%20my%20recent%20order" target="_blank" class="track-btn">Track Order</a>
            </div>
        </div>
    `;
    
    container.innerHTML = confirmationHTML;
}

// Auto-fill user data if logged in
document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user) {
        const emailField = document.getElementById('customer-email');
        if (emailField && user.email) {
            emailField.value = user.email;
        }
    }
});